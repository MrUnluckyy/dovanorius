-- Renew-on-activity: let a reserver extend their own active hold (e.g. when
-- they re-open the item). Resets the reminder so they get a fresh nudge before
-- the new expiry. SECURITY DEFINER so anonymous reservers can call it.
--
-- HOW TO RUN: paste into the Supabase SQL editor (idempotent).
-- Requires the Phase 2/3 migrations to be applied first.

create or replace function public.renew_reservation(p_item_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  new_expiry timestamptz;
begin
  update public.items
     set reserve_expires_at = now() + interval '30 days',
         reminder_sent_at = null
   where id = p_item_id
     and reserved_by = auth.uid()
     and status = 'reserved'
   returning reserve_expires_at into new_expiry;

  return new_expiry; -- null if nothing was renewed (not owner / not reserved)
end;
$$;

revoke all on function public.renew_reservation(uuid) from public;
grant execute on function public.renew_reservation(uuid) to authenticated;
