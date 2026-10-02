-- Assignments may never pair two people the organiser excluded.
--
-- App builds already in people's hands draw names on the device and ignore
-- ss_exclusions entirely, so a couple who asked not to draw each other could
-- still be paired. The database now refuses such a row: those builds fail the
-- draw with an error instead of silently breaking the rule. ss_run_draw()
-- never produces an excluded pair, so it is unaffected.
--
-- Either direction counts: an exclusion row (a, b) forbids a->b and b->a.
-- UPDATE is covered too, so a pair can't be edited into an excluded one.

create or replace function public.ss_assignments_respect_exclusions()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if exists (
    select 1
      from ss_exclusions x
     where x.event_id = new.event_id
       and (   (x.a = new.giver    and x.b = new.receiver)
            or (x.a = new.receiver and x.b = new.giver))
  ) then
    raise exception 'excluded_pair' using errcode = '23514';
  end if;
  return new;
end
$function$;

comment on function public.ss_assignments_respect_exclusions() is
  'Trigger: rejects an ss_assignments row whose giver/receiver are an ss_exclusions pair (either direction) with error excluded_pair.';

drop trigger if exists ss_assignments_respect_exclusions on public.ss_assignments;
create trigger ss_assignments_respect_exclusions
  before insert or update of giver, receiver, event_id on public.ss_assignments
  for each row execute function public.ss_assignments_respect_exclusions();
