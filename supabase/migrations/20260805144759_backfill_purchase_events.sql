-- Task 4: backfill purchase_events from the purchased items that still exist.
--
-- CAVEAT ON purchased_at ACCURACY:
-- Rows where items.purchased_at IS NULL fall back to items.updated_at, which is
-- an APPROXIMATION of the purchase moment (updated_at is bumped by any edit to
-- the row, not only by the purchase). These are the oldest survivors: the old
-- cleanup job's WHERE clause required a non-null purchased_at, so it never
-- deleted them. They are captured here deliberately. Anything purchased and
-- deleted before this migration is unrecoverable.
--
-- Idempotent: safe to re-run, the (item_id, purchased_at) unique index absorbs
-- rows already written by the capture trigger.
insert into public.purchase_events (
  item_id, board_id, purchaser_id, owner_id, title, price, currency,
  url, merchant_domain, item_created_at, purchased_at
)
select
  i.id,
  i.board_id,
  i.reserved_by,
  b.owner_id,
  i.title,
  i.price,
  i.currency,
  i.url,
  public.extract_domain(i.url),
  i.created_at,
  coalesce(i.purchased_at, i.updated_at, i.created_at, now())
from public.items i
left join public.boards b on b.id = i.board_id
where i.status = 'purchased'
on conflict (item_id, purchased_at) do nothing;
