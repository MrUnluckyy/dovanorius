-- Tell everyone in the draw that it happened.
--
-- After the organiser drew, nothing reached the participants: they found out
-- only by opening the event. One 'ss_drawn' notification per confirmed member
-- now, fired by the status change itself, so the web action, the app and the
-- shared ss_run_draw() all get it without each remembering to send it.
--
-- The person who ran the draw (auth.uid()) is skipped; they just watched it
-- happen. A status change made without a user session (service role, SQL
-- console) notifies everyone.

create or replace function public.ss_events_notify_drawn()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into notifications (user_id, type, payload)
  select m.user_id,
         'ss_drawn',
         jsonb_build_object(
           'event_id',   new.id,
           'event_name', new.name,
           'slug',       new.slug
         )
    from ss_members m
   where m.event_id = new.id
     and m.is_confirmed
     and m.user_id is distinct from auth.uid()
     -- notifications.user_id references profiles; a member without a profile
     -- row would abort the whole draw on the FK.
     and exists (select 1 from profiles p where p.id = m.user_id);
  return new;
end
$function$;

comment on function public.ss_events_notify_drawn() is
  'Trigger: one ss_drawn notification per confirmed member (except the drawer) when ss_events.status becomes drawn.';

drop trigger if exists ss_events_notify_drawn on public.ss_events;
create trigger ss_events_notify_drawn
  after update of status on public.ss_events
  for each row
  when (new.status = 'drawn' and old.status is distinct from new.status)
  execute function public.ss_events_notify_drawn();
