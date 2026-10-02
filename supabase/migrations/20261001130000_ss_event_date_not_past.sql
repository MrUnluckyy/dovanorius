-- An event can't be set to a date that has already passed.
--
-- The date inputs had no minimum, so organisers created events "on" a date
-- in the past by mis-tapping the year, and the app (which has its own forms)
-- had no rule at all. The rule lives here so both clients get it.
--
-- "Today" is Lithuanian today: an organiser in Vilnius at 00:30 on the 24th
-- must be able to pick the 24th, which is still the 23rd in UTC.
--
-- It can't be absurdly far ahead either. The browser's date field let you type
-- a six-digit year ("30/09/21013"), Postgres stores dates up to year 5874897,
-- and the app's formatter only reads four-digit years, so such an event showed
-- "no date" everywhere. Ten years ahead is the limit ('date_too_far').
--
-- Only a date that is being set or changed is checked. Saving other fields of
-- an event whose date has since passed (the settings sheet always sends
-- event_date along) is not an error.

create or replace function public.ss_events_date_not_past()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_today date := (now() at time zone 'Europe/Vilnius')::date;
begin
  if new.event_date is null
     or (tg_op = 'UPDATE' and new.event_date is not distinct from old.event_date)
  then
    return new;
  end if;
  if new.event_date < v_today then
    raise exception 'date_in_past' using errcode = '23514';
  end if;
  -- date + interval: 29 Feb + 10 years lands on 28 Feb, never an invalid day.
  if new.event_date > (v_today + interval '10 years')::date then
    raise exception 'date_too_far' using errcode = '23514';
  end if;
  return new;
end
$function$;

comment on function public.ss_events_date_not_past() is
  'Trigger: rejects a new or changed ss_events.event_date before today in Europe/Vilnius (date_in_past) or more than 10 years after it (date_too_far).';

drop trigger if exists ss_events_date_not_past on public.ss_events;
create trigger ss_events_date_not_past
  before insert or update of event_date on public.ss_events
  for each row execute function public.ss_events_date_not_past();
