-- Event notifications go away with what they point at.
--
-- notifications.payload carries event_id / invite_id, but nothing tied the
-- rows to the event: deleting an event left every 'ss_invite', 'ss_joined'
-- and 'ss_drawn' notification behind, so people kept an invitation to an
-- event that no longer existed (17 such rows in prod on 2026-10-02, 9 unread).
-- A revoked invitation had the same problem: its notification stayed, and
-- accepting it failed.
--
-- Now:
--   * deleting an event deletes its ss_* notifications;
--   * an invite that is revoked or deleted takes its ss_invite notification
--     with it;
--   * the existing orphans are removed once, below.

create index if not exists notifications_event_id_idx
  on public.notifications ((payload->>'event_id'))
  where payload ? 'event_id';

create or replace function public.ss_events_delete_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  delete from notifications
   where type like 'ss\_%'
     and payload ? 'event_id'
     and payload->>'event_id' = old.id::text;
  return old;
end
$function$;

drop trigger if exists ss_events_delete_notifications on public.ss_events;
create trigger ss_events_delete_notifications
  after delete on public.ss_events
  for each row execute function public.ss_events_delete_notifications();

create or replace function public.ss_invites_delete_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  delete from notifications
   where type = 'ss_invite'
     and payload->>'invite_id' = old.id::text;
  return null;
end
$function$;

drop trigger if exists ss_invites_delete_notification_on_delete on public.ss_invites;
create trigger ss_invites_delete_notification_on_delete
  after delete on public.ss_invites
  for each row execute function public.ss_invites_delete_notification();

drop trigger if exists ss_invites_delete_notification_on_revoke on public.ss_invites;
create trigger ss_invites_delete_notification_on_revoke
  after update of status on public.ss_invites
  for each row
  when (new.status = 'revoked' and old.status is distinct from new.status)
  execute function public.ss_invites_delete_notification();

-- One-time: notifications for events that are already gone.
delete from public.notifications n
 where n.type like 'ss\_%'
   and n.payload ? 'event_id'
   and not exists (select 1 from public.ss_events e where e.id::text = n.payload->>'event_id');
