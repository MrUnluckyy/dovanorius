-- Invite notifications are written by the database, not by each client.
--
-- Until now every client inserted the 'ss_invite' notification itself, through
-- ss_notify_invite(), right after upserting the invite. That put the rule in
-- two codebases (web + noriuto-app), and any path that wrote ss_invites
-- without the follow-up call sent the invitation silently.
--
-- The trigger fires on a new pending invite, and on an existing one moving
-- back to pending: inviteUsers upserts on (event_id, to_user), so re-inviting
-- someone who declined or was revoked is an UPDATE, not an INSERT. An upsert
-- that leaves a still-pending invite pending changes nothing and notifies
-- nobody, so re-sending to the same people doesn't stack notifications.

create or replace function public.ss_invites_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into notifications (user_id, type, payload)
  select new.to_user,
         'ss_invite',
         jsonb_build_object(
           'event_id',   e.id,
           'invite_id',  new.id,
           'event_name', e.name,
           'slug',       e.slug
         )
    from ss_events e
   where e.id = new.event_id;
  return new;
end
$function$;

comment on function public.ss_invites_notify() is
  'Trigger: one ss_invite notification per invite that becomes pending (insert, or update back to pending).';

drop trigger if exists ss_invites_notify_insert on public.ss_invites;
create trigger ss_invites_notify_insert
  after insert on public.ss_invites
  for each row
  when (new.status = 'pending')
  execute function public.ss_invites_notify();

drop trigger if exists ss_invites_notify_repending on public.ss_invites;
create trigger ss_invites_notify_repending
  after update of status on public.ss_invites
  for each row
  when (new.status = 'pending' and old.status is distinct from new.status)
  execute function public.ss_invites_notify();

-- Kept as a no-op with the same signature: app builds already in people's
-- hands still call it after inviting, and with the trigger in place a real
-- insert here would deliver every invitation twice.
create or replace function public.ss_notify_invite(
  p_event_id   uuid,
  p_invite_id  uuid,
  p_to_user    uuid,
  p_event_name text,
  p_slug       text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- Intentionally empty: the ss_invites triggers notify now.
  return;
end
$function$;

comment on function public.ss_notify_invite(uuid, uuid, uuid, text, text) is
  'Deprecated no-op, kept for old app builds. Invite notifications come from the ss_invites_notify triggers (20261001100000).';
