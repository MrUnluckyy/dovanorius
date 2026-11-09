-- Managed participants: someone the organiser adds to an event by name only,
-- because they have no phone, no e-mail, or no wish to use one. Asked for by a
-- family whose older members "wait until we meet so we can help them".
--
-- A managed participant is a real (anonymous) auth user, so every foreign key
-- to profiles, the draw engine (ss_run_draw / ss_redraw), exclusions and
-- boards work unchanged. What makes them managed is one row here, naming the
-- organiser who looks after them. Nobody ever signs in as them.
--
-- They are created ONLY from an event (app/actions/events/managed.ts, through
-- ss_setup_managed_member below, which only service_role may call). The
-- organiser then:
--   * sees who they drew (ss_managed_assignment / ss_mark_revealed_managed),
--     which knowingly breaks the secret for that one pairing; the UI says so;
--   * keeps their wish list: a board owned by the managed person with the
--     organiser as editor, i.e. the existing shared-board feature.
--
-- Shared with noriuto-app: there they show up as an ordinary member.

create table if not exists public.managed_users (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  manager_id       uuid not null references public.profiles(id) on delete cascade,
  created_in_event uuid references public.ss_events(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists managed_users_manager_idx on public.managed_users (manager_id);

alter table public.managed_users enable row level security;

-- Read-only for the organiser who manages them. No insert/update/delete
-- policies: rows are only written by ss_setup_managed_member.
drop policy if exists managed_users_select_manager on public.managed_users;
create policy managed_users_select_manager on public.managed_users
  for select to authenticated
  using (manager_id = auth.uid());

grant select on public.managed_users to authenticated;

-- ── Setup ───────────────────────────────────────────────────────────────────
-- Called by the server with the service role right after it created a fresh
-- anonymous user. Re-checks everything itself: the caller passes the manager
-- explicitly because a service-role call has no auth.uid().
create or replace function public.ss_setup_managed_member(
  p_event_id uuid,
  p_manager  uuid,
  p_user     uuid,
  p_name     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.ss_events;
  v_name  text := left(btrim(coalesce(p_name, '')), 60);
  v_board uuid;
begin
  if v_name = '' then
    return jsonb_build_object('ok', false, 'error', 'name_required');
  end if;

  select * into v_event from ss_events where id = p_event_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_event.type not in ('secret_santa', 'name_draw') then
    return jsonb_build_object('ok', false, 'error', 'not_draw_type');
  end if;
  -- Same rule as joining: nobody new once registration closed or names drawn.
  if v_event.status in ('locked', 'drawn', 'archived') then
    return jsonb_build_object('ok', false, 'error', 'event_closed');
  end if;

  if not (
    v_event.owner_id = p_manager
    or exists (select 1 from ss_members m
                where m.event_id = p_event_id and m.user_id = p_manager
                  and m.role in ('owner', 'admin'))
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  -- Only a brand-new, anonymous, unused user can become managed, so this can
  -- never be used to take over somebody's real account or guest seat.
  if not exists (
    select 1 from auth.users u
     where u.id = p_user
       and u.is_anonymous
       and u.created_at > now() - interval '10 minutes'
  ) or exists (select 1 from ss_members m where m.user_id = p_user)
    or exists (select 1 from managed_users mu where mu.user_id = p_user)
    or exists (select 1 from boards b where b.owner_id = p_user) then
    return jsonb_build_object('ok', false, 'error', 'bad_user');
  end if;

  -- handle_new_user already made an unlisted profile; name it.
  update profiles set display_name = v_name, public = false where id = p_user;

  insert into managed_users (user_id, manager_id, created_in_event)
  values (p_user, p_manager, p_event_id);

  insert into ss_members (event_id, user_id, display_name, role, is_confirmed)
  values (p_event_id, p_user, v_name, 'member', true);

  -- A wish list only means something where gifts change hands. Public, so the
  -- giver can open it from the reveal like anyone else's; the profile stays
  -- unlisted, so it is not in the people directory.
  if v_event.type = 'secret_santa' then
    insert into boards (owner_id, name, is_public)
    values (p_user, v_name || ' – norų sąrašas', true)
    returning id into v_board;
    -- boards_owner_member already added the managed user as owner.
    insert into board_members (board_id, user_id, role)
    values (v_board, p_manager, 'editor')
    on conflict do nothing;
  end if;

  return jsonb_build_object('ok', true, 'user_id', p_user, 'board_id', v_board);
end;
$$;

revoke all on function public.ss_setup_managed_member(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.ss_setup_managed_member(uuid, uuid, uuid, text)
  to service_role;

-- ── The organiser's view of a managed person's draw ─────────────────────────
create or replace function public.ss_managed_assignment(p_event_id uuid, p_member uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  if not exists (select 1 from managed_users mu
                  where mu.user_id = p_member and mu.manager_id = auth.uid())
     or not exists (select 1 from ss_members m
                     where m.event_id = p_event_id and m.user_id = p_member) then
    return null;
  end if;

  select a.receiver, coalesce(a.revealed, false) as revealed into v_row
    from ss_assignments a
   where a.event_id = p_event_id and a.giver = p_member
   limit 1;
  if not found then
    return null;
  end if;

  return jsonb_build_object('receiver', v_row.receiver, 'revealed', v_row.revealed);
end;
$$;

revoke all on function public.ss_managed_assignment(uuid, uuid) from public, anon;
grant execute on function public.ss_managed_assignment(uuid, uuid) to authenticated;

-- Same as ss_mark_revealed, on the managed person's behalf. It counts as a
-- reveal for ss_redraw too: the organiser has now seen a pairing.
create or replace function public.ss_mark_revealed_managed(p_event_id uuid, p_member uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update ss_assignments a
     set revealed = true
   where a.event_id = p_event_id
     and a.giver = p_member
     and not a.revealed
     and exists (select 1 from managed_users mu
                  where mu.user_id = p_member and mu.manager_id = auth.uid());
$$;

revoke all on function public.ss_mark_revealed_managed(uuid, uuid) from public, anon;
grant execute on function public.ss_mark_revealed_managed(uuid, uuid) to authenticated;

-- ── Profiles: keep a managed person's board off the organiser's profile ──────
-- This lists boards a person owns OR edits. The organiser edits every managed
-- person's board, which would otherwise publish those lists on the
-- organiser's own profile. Unchanged apart from the last condition.
create or replace function public.users_boards_with_previews(p_user_id uuid)
returns table(id uuid, name text, description text, slug text, is_owner boolean, item_count bigint, preview_images text[])
language sql
stable
security definer
as $function$select
  b.id,
  b.name,
  b.description,
  b.slug,

  -- is this board owned OR editable by the *viewer* (auth.uid())?
  (
    b.owner_id = auth.uid()
    or exists (
      select 1
      from public.board_members bm2
      where bm2.board_id = b.id
        and bm2.user_id = auth.uid()
        and bm2.role = 'editor'
    )
  ) as is_owner,

  -- only wanted + reserved items
  count(i.*)::bigint as item_count,

  coalesce(
    array(
      select i2.image_url
      from public.items i2
      where i2.board_id = b.id
        and i2.archived_at is null
        and i2.image_url is not null
        and i2.status in ('wanted', 'reserved')
      order by i2.created_at desc
      limit 3
    ),
    '{}'
  ) as preview_images
from public.boards b
left join public.items i
  on i.board_id = b.id
  and i.archived_at is null
  and i.status in ('wanted', 'reserved')
where
  (
    b.owner_id = p_user_id
    or (
      exists (
        select 1
        from public.board_members bm
        where bm.board_id = b.id
          and bm.user_id = p_user_id
          and bm.role = 'editor'
      )
      and not exists (
        select 1 from public.managed_users mu where mu.user_id = b.owner_id
      )
    )
  )
  and b.is_public = true
group by b.id;$function$;

-- ── Repeating an event: managed people come along as members ────────────────
-- Everyone else gets an invitation to accept. A managed person can never
-- accept one, so they would sit as "pending" forever; the organiser who
-- manages them brings them straight in instead. Unchanged apart from the two
-- statements after the invitations.
create or replace function public.ss_repeat_event(p_event_id uuid, p_name text, p_event_date date)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid     uuid := auth.uid();
  v_today   date := (now() at time zone 'Europe/Vilnius')::date;
  v_name    text := left(btrim(coalesce(p_name, '')), 120);
  v_plan    jsonb;
  v_src     ss_events%rowtype;
  v_recent  ss_events%rowtype;
  v_new_id  uuid;
  v_slug    text;
  v_invited int := 0;
begin
  if v_name = '' then
    return jsonb_build_object('ok', false, 'error', 'name_required');
  end if;
  if p_event_date is null then
    return jsonb_build_object('ok', false, 'error', 'date_required');
  end if;
  if p_event_date < v_today then
    return jsonb_build_object('ok', false, 'error', 'date_in_past');
  end if;
  if p_event_date > (v_today + interval '10 years')::date then
    return jsonb_build_object('ok', false, 'error', 'date_too_far');
  end if;

  select * into v_src from ss_events where id = p_event_id for update;

  v_plan := ss_repeat_plan(p_event_id);
  if not (v_plan->>'ok')::boolean then
    return v_plan;
  end if;

  select * into v_recent
    from ss_events
   where previous_event_id = v_src.id
     and owner_id = v_uid
     and created_at >= now() - interval '2 minutes'
   order by created_at desc
   limit 1;
  if found then
    return jsonb_build_object('ok', true, 'event_id', v_recent.id, 'slug', v_recent.slug, 'invited', 0);
  end if;

  v_slug := trim(both '-' from regexp_replace(lower(nr_unaccent(v_name)), '[^a-z0-9]+', '-', 'g'));
  v_slug := coalesce(nullif(v_slug, ''), 'renginys') || '-' || substr(md5(random()::text), 1, 6);

  insert into ss_events (slug, owner_id, name, type, budget, currency, notes, event_date,
                         status, previous_event_id, avoid_previous_match)
  values (v_slug, v_uid, v_name, v_src.type, v_src.budget, coalesce(v_src.currency, 'EUR'),
          v_src.notes, p_event_date, 'open', v_src.id, true)
  returning id into v_new_id;

  insert into ss_exclusions (event_id, a, b, mutual)
  select v_new_id, e.a, e.b, e.mutual
    from ss_exclusions e
   where e.event_id = v_src.id;

  insert into ss_invites (event_id, from_user, to_user, status)
  select v_new_id, v_uid, x.id::uuid, 'pending'
    from jsonb_array_elements_text(v_plan->'invitee_ids') as x(id)
  on conflict (event_id, to_user) do update set status = 'pending';
  get diagnostics v_invited = row_count;

  insert into ss_members (event_id, user_id, display_name, role, is_confirmed)
  select v_new_id, m.user_id, m.display_name, 'member', true
    from ss_members m
    join managed_users mu on mu.user_id = m.user_id and mu.manager_id = v_uid
   where m.event_id = v_src.id
  on conflict (event_id, user_id) do nothing;

  delete from ss_invites i
   where i.event_id = v_new_id
     and exists (select 1 from managed_users mu
                  where mu.user_id = i.to_user and mu.manager_id = v_uid);

  return jsonb_build_object('ok', true, 'event_id', v_new_id, 'slug', v_slug, 'invited', v_invited);
end
$function$;
