-- Guests can get back into their event, and accounts inherit guest seats.
--
-- A guest joins on an anonymous session, which exists only in that browser. On
-- 2026-11-03 people in one event signed in with Google and "lost" the event: to
-- Supabase that was a brand new user, and the seat and the drawn pairing stayed
-- with the anonymous one. Each case was fixed by hand.
--
-- Two ways back, both resting on proof of the inbox:
--   * ss_merge_guest_seats  moves a seat to the account with the verified address
--   * ss_access_links       short-lived emailed link for people with no account
--
-- The address a guest typed is unverified. That is safe because it only ever
-- decides where mail goes or which verified owner inherits the seat; it never
-- grants access by itself.

begin;

create index if not exists ss_event_invites_accepted_email_idx
  on public.ss_event_invites (lower(email))
  where email is not null and accepted_by is not null;

-- ── 1. Emailed links ─────────────────────────────────────────────────────────
-- Only the hash is stored, so reading this table cannot open anyone's event.
-- Service role only: no policies on purpose.
create table if not exists public.ss_access_links (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  event_id    uuid not null references public.ss_events(id) on delete cascade,
  email       text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists ss_access_links_event_email_idx
  on public.ss_access_links (event_id, email, created_at desc);

alter table public.ss_access_links enable row level security;
revoke all on table public.ss_access_links from anon, authenticated;

-- ── 2. Who holds a seat under this address ───────────────────────────────────
-- One anonymous uid is one person, so a guest matches through ANY address they
-- gave: an event repeated from an earlier one copies the member but no invite.
create or replace function public.ss_guest_uids_for_email(p_email text)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
    from auth.users u
   where u.is_anonymous
     and lower(u.email_change) = lower(trim(p_email))
  union
  select i.accepted_by
    from ss_event_invites i
    join auth.users u on u.id = i.accepted_by and u.is_anonymous
   where i.email is not null
     and lower(i.email) = lower(trim(p_email));
$$;

revoke all on function public.ss_guest_uids_for_email(text) from public, anon, authenticated;

-- Which uid an emailed link should sign in. An account wins over a guest seat,
-- because the merge moves that seat into the account anyway. Among guests, the
-- seat in the draw wins: it is the one the person is looking for.
create or replace function public.ss_access_resolve(p_event_id uuid, p_email text)
returns table (user_id uuid, is_guest boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email   text := lower(trim(coalesce(p_email, '')));
  v_account uuid;
  v_seat    uuid;
begin
  if v_email = '' then
    return;
  end if;

  select u.id into v_account
    from auth.users u
   where lower(u.email) = v_email
     and u.is_anonymous is not true
     and u.email_confirmed_at is not null
   limit 1;

  select m.user_id into v_seat
    from ss_members m
   where m.event_id = p_event_id
     and (m.user_id = v_account
          or m.user_id in (select public.ss_guest_uids_for_email(v_email)))
   order by exists (select 1 from ss_assignments a
                     where a.event_id = m.event_id
                       and (a.giver = m.user_id or a.receiver = m.user_id)) desc,
            m.joined_at
   limit 1;

  if v_seat is null then
    return;
  end if;

  user_id  := coalesce(v_account, v_seat);
  is_guest := v_account is null;
  return next;
end;
$$;

revoke all on function public.ss_access_resolve(uuid, text) from public, anon, authenticated;
grant execute on function public.ss_access_resolve(uuid, text) to service_role;

-- ── 3. The merge ─────────────────────────────────────────────────────────────
-- Not callable by clients: p_email is the whole authorisation, so callers must
-- have read it from a verified auth.users row themselves.
create or replace function public.ss_merge_guest_seats(p_account uuid, p_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seat       record;
  v_guest      uuid;
  v_guest_has  boolean;
  v_target_has boolean;
  v_target_in  boolean;
  v_moved      integer := 0;
begin
  if p_account is null or nullif(trim(coalesce(p_email, '')), '') is null then
    return 0;
  end if;

  for v_guest in
    select g from public.ss_guest_uids_for_email(p_email) g where g <> p_account
  loop
    for v_seat in
      select m.id, m.event_id from ss_members m where m.user_id = v_guest
    loop
      select exists (select 1 from ss_assignments a
                      where a.event_id = v_seat.event_id
                        and (a.giver = v_guest or a.receiver = v_guest))
        into v_guest_has;
      select exists (select 1 from ss_assignments a
                      where a.event_id = v_seat.event_id
                        and (a.giver = p_account or a.receiver = p_account))
        into v_target_has;
      select exists (select 1 from ss_members m
                      where m.event_id = v_seat.event_id and m.user_id = p_account)
        into v_target_in;

      -- Both uids were drawn, so the ring treats them as two people. Merging
      -- would make somebody buy for themselves. Leave it for a human.
      if v_guest_has and v_target_has then
        raise warning 'ss_merge_guest_seats: both % and % are in the draw of event %',
          v_guest, p_account, v_seat.event_id;
        continue;
      end if;

      -- Exclusions first: the assignment trigger checks them on every update.
      -- A pair that would collapse onto itself or duplicate a row goes.
      delete from ss_exclusions x
       where x.event_id = v_seat.event_id
         and (   (x.a = v_guest and x.b = p_account)
              or (x.b = v_guest and x.a = p_account)
              or (x.a = v_guest and exists (select 1 from ss_exclusions y
                                             where y.event_id = x.event_id
                                               and y.a = p_account and y.b = x.b))
              or (x.b = v_guest and exists (select 1 from ss_exclusions y
                                             where y.event_id = x.event_id
                                               and y.a = x.a and y.b = p_account)));
      update ss_exclusions set a = p_account
       where event_id = v_seat.event_id and a = v_guest;
      update ss_exclusions set b = p_account
       where event_id = v_seat.event_id and b = v_guest;

      update ss_assignments set giver = p_account
       where event_id = v_seat.event_id and giver = v_guest;
      update ss_assignments set receiver = p_account
       where event_id = v_seat.event_id and receiver = v_guest;

      update ss_group_items set claimed_by = p_account
       where event_id = v_seat.event_id and claimed_by = v_guest;
      update ss_group_items set created_by = p_account
       where event_id = v_seat.event_id and created_by = v_guest;

      update ss_event_invites set accepted_by = p_account
       where event_id = v_seat.event_id and accepted_by = v_guest;

      -- Keeps the name the organiser and the group already know them by.
      if v_target_in then
        delete from ss_members where id = v_seat.id;
      else
        update ss_members set user_id = p_account where id = v_seat.id;
      end if;

      update ss_invites set status = 'accepted'
       where event_id = v_seat.event_id and to_user = p_account and status = 'pending';

      v_moved := v_moved + 1;
    end loop;

    -- "Names were drawn" should reach the account too. Skipped while the guest
    -- still holds a seat, since those notifications may be about that seat.
    if not exists (select 1 from ss_members m where m.user_id = v_guest) then
      update notifications set user_id = p_account
       where user_id = v_guest and type like 'ss\_%';
    end if;
  end loop;

  return v_moved;
end;
$$;

revoke all on function public.ss_merge_guest_seats(uuid, text) from public, anon, authenticated;

-- For an account that already exists when the guest seat appears, and for
-- sessions that were signed in before this shipped.
create or replace function public.claim_guest_event_seats()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    return 0;
  end if;

  -- From auth.users, never from a parameter, and only once verified: an
  -- unconfirmed signup must not be able to harvest somebody's seat.
  select u.email into v_email
    from auth.users u
   where u.id = v_uid
     and u.is_anonymous is not true
     and u.email_confirmed_at is not null;

  return public.ss_merge_guest_seats(v_uid, v_email);
end;
$$;

revoke all on function public.claim_guest_event_seats() from public, anon;
grant execute on function public.claim_guest_event_seats() to authenticated;

-- In the database so the mobile app's sign-ups are covered with no new build.
-- This runs inside Supabase's own write to auth.users, so a failure here would
-- break signing in: it may only ever warn.
create or replace function public.ss_merge_seats_on_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.ss_merge_guest_seats(new.id, new.email);
  exception when others then
    raise warning 'ss_merge_seats_on_verified failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.ss_merge_seats_on_verified() from public, anon, authenticated;

-- Sorts after on_auth_user_created on purpose: ss_members.user_id references
-- profiles, so the profile row has to exist first.
drop trigger if exists on_auth_user_verified_merge_seats on auth.users;
create trigger on_auth_user_verified_merge_seats
  after insert or update of email_confirmed_at on auth.users
  for each row
  when (new.email_confirmed_at is not null
        and new.email is not null
        and new.is_anonymous is not true)
  execute function public.ss_merge_seats_on_verified();

-- ── 4. The address on a guest's seat ─────────────────────────────────────────
create or replace function public.ss_my_guest_email(p_event_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select i.email from ss_event_invites i
      where i.event_id = p_event_id and i.accepted_by = auth.uid() and i.email is not null
      order by i.accepted_at desc nulls last limit 1),
    (select i.email from ss_event_invites i
      where i.accepted_by = auth.uid() and i.email is not null
      order by i.accepted_at desc nulls last limit 1),
    (select nullif(u.email_change, '') from auth.users u where u.id = auth.uid())
  );
$$;

revoke all on function public.ss_my_guest_email(uuid) from public, anon;
grant execute on function public.ss_my_guest_email(uuid) to authenticated;

-- Without this a typo at the door would lock a guest out of their own seat.
create or replace function public.ss_set_my_guest_email(p_event_id uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_uid is null or not exists (
    select 1 from ss_members m where m.event_id = p_event_id and m.user_id = v_uid
  ) or not exists (
    select 1 from auth.users u where u.id = v_uid and u.is_anonymous
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_a_guest');
  end if;

  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  if exists (
    select 1 from auth.users u
     where lower(u.email) = v_email
       and u.is_anonymous is not true
       and u.email_confirmed_at is not null
  ) then
    return jsonb_build_object('ok', false, 'error', 'email_has_account');
  end if;

  update ss_event_invites set email = v_email
   where event_id = p_event_id and accepted_by = v_uid;

  if not found then
    insert into ss_event_invites (event_id, email, via_link, accepted_at, accepted_by)
    values (p_event_id, v_email, true, now(), v_uid);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.ss_set_my_guest_email(uuid, text) from public, anon;
grant execute on function public.ss_set_my_guest_email(uuid, text) to authenticated;

-- ── 5. The join form spots someone who is already in ─────────────────────────
-- Otherwise a guest on a new phone joins as a second person, or hits "closed"
-- once names are drawn. Tells a link holder only that this address is on the
-- roster, which joining would show them anyway.
create or replace function public.ss_join_email_status(p_token text, p_email text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_event uuid;
begin
  select id into v_event from ss_events where join_token = p_token;
  if v_event is null then
    select event_id into v_event from ss_event_invites where token = p_token;
  end if;
  if v_event is null then
    return 'invalid_token';
  end if;

  if v_email = '' then
    return 'free';
  end if;

  if exists (select 1 from public.ss_access_resolve(v_event, v_email)) then
    return 'member';
  end if;

  if exists (
    select 1
      from auth.users u
     where lower(u.email) = v_email
       and u.is_anonymous is not true
       and u.email_confirmed_at is not null
  ) then
    return 'account';
  end if;

  return 'free';
end;
$$;

-- ── 6. Anyone stranded before this shipped ───────────────────────────────────
do $$
declare
  v_user record;
begin
  for v_user in
    select u.id, u.email
      from auth.users u
     where u.is_anonymous is not true
       and u.email_confirmed_at is not null
       and u.email is not null
       and exists (select 1 from public.ss_guest_uids_for_email(u.email))
  loop
    perform public.ss_merge_guest_seats(v_user.id, v_user.email);
  end loop;
end;
$$;

commit;
