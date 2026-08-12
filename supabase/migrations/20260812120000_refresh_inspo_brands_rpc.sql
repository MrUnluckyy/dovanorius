-- Let the importer refresh the brand list itself.
--
-- inspo_brands_mv backs the brand filter on /discover/browse. Refreshing it was
-- a comment in its own migration ("refresh materialized view concurrently ...")
-- and therefore a manual step, which meant nobody ran it: by 2026-08-12 the MV
-- held 424 brands while 829 qualified. Every brand the TradeDoubler import
-- brought in -- the whole Pigu and About You catalogue -- was missing from the
-- filter, and 109 brands that had dropped below the threshold were still listed.
--
-- CONCURRENTLY is deliberately NOT used here. PostgREST runs every RPC inside a
-- transaction and REFRESH ... CONCURRENTLY cannot run in one. A plain refresh
-- takes an ACCESS EXCLUSIVE lock on the MV, so brand-filter reads block until it
-- finishes -- acceptable because the MV is small, the rebuild is seconds, and
-- the caller is a nightly job at ~03:00 UTC.

create or replace function public.refresh_inspo_brands()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  refresh materialized view public.inspo_brands_mv;
  select count(*) into n from public.inspo_brands_mv;
  return n;
end;
$$;

revoke all on function public.refresh_inspo_brands() from public, anon, authenticated;
grant execute on function public.refresh_inspo_brands() to service_role;

comment on function public.refresh_inspo_brands() is
  'Rebuild inspo_brands_mv (brand filter). Called at the end of every feed import; returns the new row count.';
