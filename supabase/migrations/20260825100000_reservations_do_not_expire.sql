-- Reservations no longer expire.
--
-- The sweep was built to stop abandoned holds locking a gift forever. It cannot
-- do that, because it cannot tell an abandoned hold from a delivered one: a
-- giver has no way to record that they bought the gift (RLS on items lets only
-- the board owner, an editor, or the wish's creator write status='purchased' —
-- never the reserver), so "bought and given" and "forgotten" are the same row.
--
-- So the sweep fired indiscriminately, and most often on successes. The two
-- failures are nowhere near equal:
--
--   hold never ends   -> the item reads as taken, another giver picks something
--                        else, nobody loses money, and any release fixes it.
--   hold ends wrongly -> two people buy the same gift. Real money, and it is
--                        precisely the failure a reservation exists to prevent.
--
-- Doing nothing must preserve the safe state. Silence now keeps a hold; only an
-- explicit release ends one. The reminder email becomes a check-in ("still
-- planning to give this?") that needs no reply.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL editor (idempotent).

begin;

-- 1. Stop the daily sweep. The job, not the function: keeping the function
--    means this is one `cron.schedule` away from being reversible, and it stays
--    available for a deliberate one-off cleanup.
do $$
begin
  perform cron.unschedule('release-expired-reservations');
exception
  when others then null; -- already unscheduled
end $$;

-- 2. Close a hole worth closing on the way past: the function was executable by
--    anon and authenticated, so anyone holding the publishable key could have
--    released every expired hold in the database on demand.
revoke all on function public.release_expired_reservations() from public, anon, authenticated;

comment on function public.release_expired_reservations() is
  'DORMANT. Unscheduled 2026-08-25 — reservations no longer expire. Kept for a '
  'deliberate manual cleanup only; do not re-schedule without re-reading '
  '20260825100000_reservations_do_not_expire.sql.';

-- 3. items.reserve_expires_at keeps its name (the mobile app reads it) but no
--    longer means a deadline. It is now the date we check in on a hold, still
--    stamped by set_reservation_ttl and pushed out by renew_reservation.
comment on column public.items.reserve_expires_at is
  'Check-in date, NOT a deadline. Nothing releases a hold when this passes; the '
  'reminder email is sent around it. See 20260825100000.';

commit;
