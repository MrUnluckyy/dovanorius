-- Events: recognise an address that already has an account, before joining.
--
-- A guest who typed the address of their own registered account got joined
-- anyway, as a second, anonymous person: the roster gained a ghost with their
-- name, their real account stayed outside the event, and they were sent a
-- "you're in" email pointing at something that account cannot open. The
-- attach-email call failed afterwards, far too late to prevent any of it.
--
-- The check has to run before the anonymous session is created, so it needs to
-- be callable by `anon`. That makes it an oracle for "does this address have a
-- Noriuto account", so it is gated on holding a valid join token: you have to
-- have been invited before you can ask.
--
-- Only a CONFIRMED, non-anonymous account blocks the way. An unconfirmed
-- address is still free — Supabase parks a pending change in `new_email` and
-- does not reserve it — which is what lets one guest use the same address for
-- several events before they ever click a confirmation link.
--
-- HOW TO RUN: paste into the Supabase SQL editor (idempotent).

begin;

create or replace function public.ss_join_email_status(
  p_token text,
  p_email text
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not exists (select 1 from ss_events        where join_token = p_token)
     and not exists (select 1 from ss_event_invites where token = p_token) then
    return 'invalid_token';
  end if;

  if v_email = '' then
    return 'free';
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

comment on function public.ss_join_email_status(text, text) is
  'Whether an address already belongs to a confirmed Noriuto account, so the join screen can ask that person to sign in instead of creating a duplicate guest. Gated on a valid join token to avoid becoming an email-enumeration oracle.';

revoke all on function public.ss_join_email_status(text, text) from public;
grant execute on function public.ss_join_email_status(text, text) to anon, authenticated;

-- Defence in depth: even if a client skips the check above, an anonymous
-- caller may not take a seat using an address that belongs to a real account.
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
  v_anon   boolean;
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

  if exists (select 1 from ss_members m
              where m.event_id = v_event.id and m.user_id = v_uid) then
    return jsonb_build_object(
      'ok', true, 'slug', v_event.slug, 'event_name', v_event.name,
      'already_member', true
    );
  end if;

  if v_event.status in ('locked', 'drawn', 'archived') then
    return jsonb_build_object('ok', false, 'error', 'event_closed',
                              'status', v_event.status::text);
  end if;

  select coalesce(u.is_anonymous, false) into v_anon
    from auth.users u where u.id = v_uid;

  if v_anon and v_email is not null and exists (
    select 1 from auth.users u
     where lower(u.email) = v_email
       and u.is_anonymous is not true
       and u.email_confirmed_at is not null
  ) then
    return jsonb_build_object('ok', false, 'error', 'email_has_account');
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
    insert into ss_event_invites
      (event_id, email, display_name, via_link, accepted_at, accepted_by)
    values (v_event.id, v_email, v_name, true, now(), v_uid);
  end if;

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

commit;
