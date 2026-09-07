-- Events: shareable join links, e-mail invites, and guest joining.
--
-- Until now the only way into an event was ss_invites, which takes a `to_user`
-- uuid — you had to already have a Noriuto account AND already be followed by
-- the organiser. There was nothing to paste into a family chat. `join_code_hash`
-- has sat unused on ss_events since the table was created; a hash cannot be
-- shown back to the organiser, so this adds a readable `join_token` instead and
-- leaves the old column alone.
--
-- Two shapes of link, deliberately:
--   * ss_events.join_token   — one link per event, reusable, "anyone with this
--                              link can join". This is the WhatsApp case.
--   * ss_event_invites.token — one row per invited e-mail address, so the
--                              organiser can see who has not answered yet and
--                              revoke a single person.
-- Both are bearer credentials, exactly like board_invites, and both land on the
-- same screen.
--
-- HOW TO RUN: paste into the Supabase SQL editor (idempotent).

begin;

-- ── 1. The shareable link ────────────────────────────────────────────────────
alter table public.ss_events
  add column if not exists join_token text;

-- gen_random_uuid() is volatile, so every existing row gets its own value.
update public.ss_events
   set join_token = gen_random_uuid()::text
 where join_token is null;

alter table public.ss_events
  alter column join_token set default gen_random_uuid()::text,
  alter column join_token set not null;

create unique index if not exists ss_events_join_token_key
  on public.ss_events (join_token);

comment on column public.ss_events.join_token is
  'Bearer token for the reusable "anyone with the link can join" URL. Rotate it to kill every outstanding link at once.';

-- ── 2. Per-address invites ───────────────────────────────────────────────────
-- `email` is nullable because the same table records who came in through the
-- shared link: the organiser needs one roster of outstanding invitations, not
-- two. A row with accepted_at set and no token use is simply history.
create table if not exists public.ss_event_invites (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.ss_events(id) on delete cascade,
  email        text,
  display_name text,
  token        text not null unique default gen_random_uuid()::text,
  invited_by   uuid references auth.users(id) on delete set null,
  via_link     boolean not null default false,
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists ss_event_invites_event_id_idx
  on public.ss_event_invites (event_id);

-- One outstanding invite per address per event; re-inviting refreshes the row
-- rather than stacking duplicates in the organiser's list.
create unique index if not exists ss_event_invites_event_email_key
  on public.ss_event_invites (event_id, lower(email))
  where email is not null and accepted_at is null;

alter table public.ss_event_invites enable row level security;

drop policy if exists event_invites_admin_all on public.ss_event_invites;
create policy event_invites_admin_all on public.ss_event_invites
  for all using (is_event_admin(event_id)) with check (is_event_admin(event_id));

-- Invitees never read this table directly; the two functions below are
-- SECURITY DEFINER precisely so an unauthenticated visitor holding a token can
-- see the event name without being able to enumerate anything else.

-- ── 3. What the join screen shows before you commit ──────────────────────────
create or replace function public.get_ss_join_info(p_token text)
returns table (
  event_id     uuid,
  event_name   text,
  event_type   text,
  event_slug   text,
  event_date   date,
  budget       integer,
  currency     text,
  cover_image_url text,
  status       text,
  owner_name   text,
  member_count bigint,
  already_used boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with resolved as (
    select e.id, false as used
      from ss_events e
     where e.join_token = p_token
    union all
    select i.event_id, (i.accepted_at is not null)
      from ss_event_invites i
     where i.token = p_token
    limit 1
  )
  select e.id, e.name, e.type, e.slug, e.event_date, e.budget, e.currency,
         e.cover_image_url, e.status::text,
         p.display_name,
         (select count(*) from ss_members m where m.event_id = e.id),
         r.used
    from resolved r
    join ss_events e on e.id = r.id
    left join profiles p on p.id = e.owner_id;
$$;

revoke all on function public.get_ss_join_info(text) from public;
grant execute on function public.get_ss_join_info(text) to anon, authenticated;

-- ── 4. Joining ───────────────────────────────────────────────────────────────
-- The caller already holds a session — a real one, or the anonymous one the
-- join screen creates for a guest. The name is written to ss_members.display_name
-- AND, when the profile has none, to profiles.display_name: the roster reads the
-- profile, so a guest who skipped that would show up as a blank row.
create or replace function public.accept_ss_join(
  p_token        text,
  p_display_name text default null,
  p_email        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_event  public.ss_events;
  v_invite public.ss_event_invites;
  v_name   text := nullif(trim(coalesce(p_display_name, '')), '');
  v_email  text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_event from ss_events where join_token = p_token;

  if not found then
    select * into v_invite from ss_event_invites where token = p_token;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'invalid_token');
    end if;
    select * into v_event from ss_events where id = v_invite.event_id;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'invalid_token');
    end if;
  end if;

  -- Already in? Say so plainly and send them through; re-clicking a link you
  -- already used should open the event, not throw an error at you.
  if exists (select 1 from ss_members m
              where m.event_id = v_event.id and m.user_id = v_uid) then
    return jsonb_build_object(
      'ok', true, 'slug', v_event.slug, 'event_name', v_event.name,
      'already_member', true
    );
  end if;

  -- Once names are drawn the roster is frozen: a late joiner would have no
  -- assignment and would silently break the ring for everyone else.
  if v_event.status in ('locked', 'drawn', 'archived') then
    return jsonb_build_object('ok', false, 'error', 'event_closed',
                              'status', v_event.status::text);
  end if;

  insert into ss_members (event_id, user_id, display_name, role, is_confirmed)
  values (v_event.id, v_uid, v_name, 'member', true)
  on conflict (event_id, user_id) do update
    set display_name = coalesce(excluded.display_name, ss_members.display_name),
        is_confirmed = true;

  update profiles
     set display_name = v_name
   where id = v_uid
     and v_name is not null
     and (display_name is null or display_name = '');

  if v_invite.id is not null then
    update ss_event_invites
       set accepted_at = now(), accepted_by = v_uid,
           display_name = coalesce(v_name, display_name)
     where id = v_invite.id;
  else
    -- Joined through the shared link: record it so the organiser sees a name
    -- and an address rather than a stranger appearing in the roster.
    insert into ss_event_invites
      (event_id, email, display_name, via_link, accepted_at, accepted_by)
    values (v_event.id, v_email, v_name, true, now(), v_uid);
  end if;

  -- Any pending user-to-user invite for the same person is now moot.
  update ss_invites
     set status = 'accepted'
   where event_id = v_event.id and to_user = v_uid and status = 'pending';

  return jsonb_build_object(
    'ok', true, 'slug', v_event.slug, 'event_name', v_event.name,
    'already_member', false
  );
end;
$$;

revoke all on function public.accept_ss_join(text, text, text) from public;
grant execute on function public.accept_ss_join(text, text, text) to authenticated;

-- ── 5. The roster must show a guest's name ───────────────────────────────────
-- ss_members.display_name existed and was never read: the view took the name
-- from `profiles`, which is null for anyone who joined as a guest. Every
-- link-joined participant would have rendered as an empty row.
create or replace view public.ss_participants
with (security_invoker = true) as
  with unioned as (
    select m.event_id,
           p.id as user_id,
           coalesce(nullif(m.display_name, ''), p.display_name) as display_name,
           p.avatar_url,
           m.role::text as role,
           'joined'::text as status,
           m.joined_at as ts
      from ss_members m
      join profiles p on p.id = m.user_id
    union all
    select i.event_id, p.id, p.display_name, p.avatar_url,
           'member'::text, i.status::text, i.created_at
      from ss_invites i
      join profiles p on p.id = i.to_user
  ), ranked as (
    select u.*,
           case u.status when 'joined' then 1 when 'accepted' then 2
                         when 'pending' then 3 when 'declined' then 4 else 9 end as status_rank,
           row_number() over (
             partition by u.event_id, u.user_id
             order by case u.status when 'joined' then 1 when 'accepted' then 2
                                    when 'pending' then 3 when 'declined' then 4 else 9 end,
                      u.ts desc
           ) as rn
      from unioned u
  )
  select event_id, user_id, display_name, avatar_url, role, status, ts as joined_at
    from ranked
   where rn = 1
   order by status_rank, ts desc;

-- ── 6. Guests do not belong in the people directory ──────────────────────────
-- handle_new_user() was fixed to insert guests with public = false, but the
-- rows created before that fix were never backfilled — 57 nameless guests are
-- still listed, and the new "invite someone on Noriuto" search would surface
-- every one of them.
update public.profiles p
   set public = false
  from auth.users u
 where u.id = p.id and u.is_anonymous and p.public;

commit;
