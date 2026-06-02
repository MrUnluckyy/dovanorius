-- Phase 3: optional reminder email for guest reservations.
--
-- HOW TO RUN: paste into the Supabase SQL editor and run (idempotent).
-- Requires Phase 2 (20260530000000_reservation_ttl.sql) to be applied first.

-- 1. Store the guest's optional reminder address + whether we've emailed yet.
alter table public.items
  add column if not exists reminder_email   text,
  add column if not exists reminder_sent_at timestamptz;

-- 2. Let the reserver (and only the reserver) attach a reminder email to
--    their own active hold. SECURITY DEFINER so anonymous reservers can call
--    it without broad UPDATE rights on items.
create or replace function public.set_reservation_reminder(
  p_item_id uuid,
  p_email   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.items
     set reminder_email = nullif(trim(p_email), '')
   where id = p_item_id
     and reserved_by = auth.uid()
     and status = 'reserved';

  if not found then
    raise exception 'Reservation not found or not owned by caller';
  end if;
end;
$$;

revoke all on function public.set_reservation_reminder(uuid, text) from public;
grant execute on function public.set_reservation_reminder(uuid, text) to authenticated;
