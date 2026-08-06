-- The partial index added in 20260805170000 could enforce uniqueness but could
-- NOT serve as an ON CONFLICT target: Postgres only infers a partial index when
-- the statement repeats its predicate, and PostgREST emits a bare
-- `on_conflict=cols`. The sync upsert therefore failed with
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- A plain unique constraint is inferable. Manual products are unaffected:
-- unique indexes treat NULLs as distinct by default, so any number of rows per
-- partner may carry a null external_id.
drop index if exists public.partner_products_partner_external_uidx;

alter table public.partner_products
  drop constraint if exists partner_products_partner_id_external_id_key;

alter table public.partner_products
  add constraint partner_products_partner_id_external_id_key
  unique (partner_id, external_id);
