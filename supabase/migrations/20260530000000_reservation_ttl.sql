-- Phase 2: soft-hold reservations with a 30-day TTL auto-expiry.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL editor and run it
-- (or `supabase db push` if you adopt the CLI). Safe to re-run (idempotent).
--
-- TO CHANGE THE WINDOW: edit the two `interval '30 days'` occurrences below.

-- 1. Columns to track when a hold started and when it lapses.
alter table public.items
  add column if not exists reserved_at        timestamptz,
  add column if not exists reserve_expires_at timestamptz;

-- 2. Auto-stamp / auto-clear the TTL whenever status crosses the
--    "reserved" boundary. Works regardless of which RPC sets the status.
create or replace function public.set_reservation_ttl()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'reserved'
     and (tg_op = 'INSERT' or old.status is distinct from 'reserved') then
    -- newly reserved: start the clock
    new.reserved_at := now();
    new.reserve_expires_at := now() + interval '30 days';
  elsif new.status is distinct from 'reserved' then
    -- unreserved / purchased: clear the hold
    new.reserved_at := null;
    new.reserve_expires_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_reservation_ttl on public.items;
create trigger trg_set_reservation_ttl
  before insert or update of status on public.items
  for each row execute function public.set_reservation_ttl();

-- 3. Backfill existing reservations so they get a fresh 30-day window
--    instead of being released on the first cron run.
update public.items
  set reserved_at = coalesce(reserved_at, now()),
      reserve_expires_at = now() + interval '30 days'
where status = 'reserved';

-- 4. Index to keep the daily sweep cheap.
create index if not exists items_reserve_expires_at_idx
  on public.items (reserve_expires_at)
  where status = 'reserved';

-- 5. The release routine: flip lapsed holds back to "wanted".
--    Only touches 'reserved' rows, so 'purchased' items are never released.
create or replace function public.release_expired_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released integer;
begin
  update public.items
    set status = 'wanted',
        reserved_by = null,
        reserved_at = null,
        reserve_expires_at = null
  where status = 'reserved'
    and reserve_expires_at is not null
    and reserve_expires_at < now();
  get diagnostics released = row_count;
  return released;
end;
$$;

-- 6. Schedule the sweep once a day (03:00 UTC). Requires pg_cron.
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('release-expired-reservations');
exception
  when others then null; -- not scheduled yet
end $$;

select cron.schedule(
  'release-expired-reservations',
  '0 3 * * *',
  $$ select public.release_expired_reservations(); $$
);
