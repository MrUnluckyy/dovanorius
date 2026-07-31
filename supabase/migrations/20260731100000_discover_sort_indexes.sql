-- Composite partial indexes so the discover feed's "<col>, id" ordering (id is
-- the stable pagination tiebreaker) is index-backed. A single-column index can't
-- satisfy the composite ORDER BY, so without these Postgres falls back to a full
-- seq-scan + sort (~8s on the filtered set).
create index if not exists inspo_products_sortkey_id_idx
  on public.inspo_products (sort_key, id)
  where in_stock;

create index if not exists inspo_products_price_id_idx
  on public.inspo_products (price, id)
  where in_stock and price >= 10;

-- Biggest-discount sort. NB: DESC (default NULLS FIRST) must match the query's
-- plain `.order("discount_pct", {ascending:false})` — a NULLS LAST query would
-- not use this index.
create index if not exists inspo_products_discount_id_idx
  on public.inspo_products (discount_pct desc, id)
  where in_stock and discount_pct is not null;
