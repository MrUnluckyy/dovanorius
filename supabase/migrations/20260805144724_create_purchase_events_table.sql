-- Task 1: permanent, append-only record of every purchase.
-- Deliberately stores a SNAPSHOT: item_id / board_id carry no foreign keys so
-- the row survives deletion of the item or the board it came from.
create table if not exists public.purchase_events (
  id               uuid primary key default gen_random_uuid(),
  item_id          uuid,                       -- snapshot reference only, no FK
  board_id         uuid,                       -- snapshot reference only, no FK
  purchaser_id     uuid,                       -- items.reserved_by at purchase time
  owner_id         uuid,                       -- boards.owner_id at purchase time
  title            text,
  price            numeric,
  currency         text,
  url              text,
  merchant_domain  text,
  item_created_at  timestamptz,
  purchased_at     timestamptz not null,
  recorded_at      timestamptz not null default now()
);

comment on table public.purchase_events is
  'Append-only analytics record of purchases. Snapshot rows: they intentionally outlive the items they describe.';

create index if not exists purchase_events_purchased_at_idx
  on public.purchase_events (purchased_at desc);
create index if not exists purchase_events_merchant_domain_idx
  on public.purchase_events (merchant_domain);
create index if not exists purchase_events_owner_id_idx
  on public.purchase_events (owner_id);

-- Idempotency guard for the capture trigger (Task 2): one event per
-- (item, purchase moment). Backs the `on conflict do nothing` there.
create unique index if not exists purchase_events_item_purchased_uidx
  on public.purchase_events (item_id, purchased_at);

alter table public.purchase_events enable row level security;

-- Personal purchase data: a user may read only rows describing purchases made
-- for them (owner) or by them (purchaser).
drop policy if exists purchase_events_select_owner_or_purchaser on public.purchase_events;
create policy purchase_events_select_owner_or_purchaser
  on public.purchase_events
  for select
  to authenticated
  using (owner_id = (select auth.uid()) or purchaser_id = (select auth.uid()));

-- No insert/update/delete policy on purpose: writes come from the
-- security definer capture trigger, the backfill, or the service role.
revoke insert, update, delete on public.purchase_events from anon, authenticated;
