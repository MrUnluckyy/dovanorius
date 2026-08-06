-- Per-partner Shopify catalogue sync.
--
-- We store the shop DOMAIN, never a full URL: the app builds
-- https://<domain>/products.json and /meta.json itself. A partner-supplied URL
-- that the server fetches nightly would be an SSRF hole (internal addresses,
-- redirects); a bare hostname closes that and gives us /meta.json for free,
-- which is where the store currency lives (products.json has no currency).
alter table public.partners
  add column if not exists shopify_domain    text,
  add column if not exists feed_enabled      boolean not null default false,
  -- Admin vets the MERCHANT once; per-product moderation stays for manual adds.
  -- Nobody can hand-approve a 500-product catalogue daily.
  add column if not exists feed_auto_approve boolean not null default false,
  add column if not exists feed_last_synced_at timestamptz,
  add column if not exists feed_last_status  text,
  add column if not exists feed_last_error   text,
  add column if not exists feed_last_count   integer;

comment on column public.partners.shopify_domain is
  'Bare shop host, e.g. redtuxedoceramics.com. The /products.json and /meta.json URLs are constructed server-side.';

-- Identity for synced rows. Manual products keep external_id null and are never
-- touched by the sync.
alter table public.partner_products
  add column if not exists external_id  text,
  add column if not exists source       text not null default 'manual',
  add column if not exists last_seen_at timestamptz;

alter table public.partner_products
  drop constraint if exists partner_products_source_check;
alter table public.partner_products
  add constraint partner_products_source_check
  check (source in ('manual', 'shopify'));

-- One row per (partner, upstream product). Partial so the many manual rows with
-- a null external_id don't collide.
create unique index if not exists partner_products_partner_external_uidx
  on public.partner_products (partner_id, external_id)
  where external_id is not null;

create index if not exists partner_products_source_idx
  on public.partner_products (partner_id, source);
