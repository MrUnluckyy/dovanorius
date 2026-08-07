-- These belonged in 20260807095652 but were lost when that migration was
-- rewritten after the generated-column attempt rolled back. Without them every
-- discover query sorts ~270k rows unindexed and dies on the statement timeout —
-- which is exactly what the page did once it started ordering by gift_score.
--
-- Partial on giftable: browse and every shelf filter on it, so the non-gift half
-- never enters the index. sort_key is part of the key because it is the
-- tiebreaker that keeps equal-score items rotating between visits.
create index if not exists inspo_products_giftscore_idx
  on public.inspo_products (gift_score desc, sort_key, id)
  where giftable;

-- Shelves and the browse category pills are "one product_type, best first".
create index if not exists inspo_products_type_giftscore_idx
  on public.inspo_products (product_type, gift_score desc, sort_key, id)
  where giftable;

-- The derivation backfill is complete, so this partial index covers zero rows.
drop index if exists public.inspo_products_backfill_idx;
