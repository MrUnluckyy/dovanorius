-- Purchase tracking for direct partners, step 2.
--
-- A partner's shop posts every new order to /api/webhooks/shopify/<partner>.
-- Only orders whose landing URL carries our tag (nr_click=<sub_id> from /out,
-- or at least utm_source=noriuto) are stored; everything else is dropped on
-- arrival. No customer data is ever kept: order id, number, total, currency,
-- date, and the click it came from.

-- Webhook signing secrets, one per partner and platform. RLS on with no
-- policies: service role only. Kept out of `partners`, which partner members
-- can read.
create table if not exists public.partner_webhook_secrets (
  partner_id  uuid not null references public.partners(id) on delete cascade,
  platform    text not null check (platform in ('shopify', 'woocommerce')),
  secret      text not null,
  created_at  timestamptz not null default now(),
  primary key (partner_id, platform)
);
alter table public.partner_webhook_secrets enable row level security;

create table if not exists public.partner_orders (
  id                 uuid primary key default gen_random_uuid(),
  partner_id         uuid not null references public.partners(id) on delete cascade,
  platform           text not null check (platform in ('shopify', 'woocommerce')),
  external_order_id  text not null,
  order_name         text,
  total              numeric(12, 2) not null,
  currency           text not null,
  ordered_at         timestamptz not null,
  -- affiliate_clicks.sub_id when the landing URL carried nr_click. No FK: a
  -- click can be deleted (or never logged) and the order is still ours.
  click_sub_id       text,
  attributed_by      text not null check (attributed_by in ('nr_click', 'utm')),
  cancelled_at       timestamptz,
  created_at         timestamptz not null default now(),
  -- Shopify retries webhooks; the second delivery must be a no-op.
  unique (partner_id, platform, external_order_id)
);

create index if not exists partner_orders_partner_idx
  on public.partner_orders (partner_id, ordered_at desc);

alter table public.partner_orders enable row level security;

-- Partners see their own attributed orders in the panel. Writes are service
-- role only (the webhook).
drop policy if exists "partner members can read their orders" on public.partner_orders;
create policy "partner members can read their orders"
  on public.partner_orders for select
  using (public.is_partner_member(partner_id));

-- Webhook bookkeeping, so admin can tell "not set up" from "set up, no sales".
alter table public.partners
  add column if not exists orders_webhook_last_at timestamptz;
