-- Index supporting the feed importer's stale sweep.
--
-- APPLIED to prod 2026-07-27 via Supabase MCP.
--
-- The sweep marks products no longer in a feed out of stock:
--   update inspo_products set in_stock = false
--   where network = ? and merchant_id in (...) and synced_at < ? and in_stock
-- On a ~600k-row table this seq-scanned and hit the statement timeout. The
-- partial index (only live rows are sweep candidates) makes it an index scan.

create index if not exists inspo_products_sweep_idx
  on public.inspo_products (network, merchant_id, synced_at)
  where in_stock;
