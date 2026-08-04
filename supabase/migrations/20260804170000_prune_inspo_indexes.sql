-- P3 cleanup: drop indexes that earn nothing but write amplification.
--
-- inspo_products carried 16 indexes (~380 MB). Every import rewrites the table,
-- and each surviving index is re-maintained per row — so dead indexes directly
-- inflate the Disk-IO pressure this whole initiative is unwinding. Scan counts
-- are lifetime (pg_stat_database.stats_reset is null), so a 0–1 scan index is
-- genuinely unused, not a stats-window artifact.
--
-- Dropped (all confirmed against pg_stat_user_indexes):
--   discount_idx      0 scans — redundant with discount_id_idx (discount_pct DESC,
--                     id) WHERE in_stock, which the "discount" sort actually uses.
--   in_stock_idx      standalone boolean; every serving path uses the partial
--                     `WHERE in_stock` indexes instead.
--   season_idx        3-value column — a btree over it is never an efficient
--                     access path; season is applied as a residual filter.
--   category_name_idx  not a discover filter (product_type is the category lever).
--
-- Kept deliberately: the sort indexes (sortkey_id, sort_key, price_id,
-- discount_id), the trigram search index, pkey, network/merchant/gender (live
-- filters), sweep_idx (the --no-prune sweep path), and partner_idx.

drop index if exists public.inspo_products_discount_idx;
drop index if exists public.inspo_products_in_stock_idx;
drop index if exists public.inspo_products_season_idx;
drop index if exists public.inspo_products_category_name_idx;
