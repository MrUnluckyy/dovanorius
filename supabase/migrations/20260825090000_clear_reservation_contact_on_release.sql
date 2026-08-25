-- A reservation's contact address must not outlive the reservation.
--
-- Every path that ends a hold (release_expired_reservations, unreserve_item, or
-- a plain status change to 'purchased') cleared reserved_by but left
-- reminder_email behind. Two consequences, both live:
--
--   1. Retention. A freed item on a public board sat there carrying a private
--      address belonging to someone with no further relationship to it.
--   2. Correctness. reserve_item does not write reminder_email, so the next
--      person to reserve that item inherited the previous holder's address —
--      and with it the expiry mail and the signed keep/release link, which
--      would have let a stranger drop their hold.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL editor (idempotent).
--
-- Deliberately a SEPARATE trigger rather than folding the clearing into
-- set_reservation_ttl: that function carries the hold window, production is
-- already on `interval '6 months'`, and the version in this repo's older
-- migrations still says 30 days. Rewriting it from here would quietly roll the
-- window back. Leave it alone.

begin;

create or replace function public.clear_reservation_contact()
returns trigger
language plpgsql
as $$
begin
  -- Only when the row leaves 'reserved'. Renewals and edits that keep the hold
  -- alive must not wipe the address we still need to remind them at.
  if new.status is distinct from 'reserved' then
    new.reminder_email := null;
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clear_reservation_contact on public.items;
create trigger trg_clear_reservation_contact
  before insert or update of status on public.items
  for each row execute function public.clear_reservation_contact();

-- Addresses already stranded on items whose hold has ended.
update public.items
   set reminder_email = null,
       reminder_sent_at = null
 where status is distinct from 'reserved'
   and (reminder_email is not null or reminder_sent_at is not null);

commit;
