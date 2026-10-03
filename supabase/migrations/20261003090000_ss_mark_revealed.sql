-- Reveal who you drew once, not on every visit.
--
-- Both clients played the "who did I get" reveal (a shuffle / slot-roll of
-- names) every time the event was opened — the app forgot it on restart, the
-- website on reload — which read as drawing again. ss_assignments.revealed has
-- existed since the start but nothing set it.
--
-- Givers can't update ss_assignments (and shouldn't: a plain UPDATE grant
-- would let them change who they drew), so marking goes through this function,
-- which can only flip the caller's own row to revealed. Shared with the app,
-- and with every device: reveal on the phone and the website shows the result.

create or replace function public.ss_mark_revealed(p_event_id uuid)
returns void
language sql
security definer
set search_path = public
as $function$
  update ss_assignments
     set revealed = true
   where event_id = p_event_id
     and giver = auth.uid()
     and not revealed;
$function$;

comment on function public.ss_mark_revealed(uuid) is
  'Marks the caller''s own assignment in an event as revealed, so the reveal animation plays once. Touches no other column or row.';

revoke all on function public.ss_mark_revealed(uuid) from public, anon;
grant execute on function public.ss_mark_revealed(uuid) to authenticated;

-- The website reads its own assignment through this view; it needs the flag.
-- Appended as the last column, so existing selects are unaffected.
create or replace view public.ss_my_assignment as
  select event_id, giver, receiver, revealed
    from ss_assignments
   where giver = auth.uid();

-- Security fix found on the way: this is a simple view owned by postgres, so
-- it was auto-updatable and writes through it skipped ss_assignments' RLS.
-- With Supabase's default grants, any signed-in user (and anon) could INSERT,
-- UPDATE or DELETE assignments through it — e.g. change who they drew. Both
-- clients only ever read it. Checked on 2026-10-03: no assignment in the data
-- shows signs of tampering (self-draws, orphans, double receivers).
revoke insert, update, delete, truncate, references, trigger on public.ss_my_assignment from anon, authenticated;
revoke all on public.ss_my_assignment from anon;
grant select on public.ss_my_assignment to authenticated;
