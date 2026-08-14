-- Partner catalogues from any supported platform, not only Shopify.
--
-- The first integration was Shopify-only and the schema said so: a column named
-- shopify_domain now has to hold hosts like kamadobono.lt, whose catalogue comes
-- from the WooCommerce Store API. Leaving the name would guarantee someone later
-- reads `shopify_domain` and assumes the platform — so it is renamed rather than
-- quietly repurposed.
--
-- Safe to rename: nothing outside this repo reads it. The mobile app
-- (../noriuto-app) shares this database but touches neither partners.shopify_domain
-- nor partner_products.
alter table public.partners rename column shopify_domain to store_domain;

comment on column public.partners.store_domain is
  'Bare shop host, e.g. redtuxedoceramics.com. Feed URLs are constructed server-side from this plus feed_platform — we never store a partner-supplied full URL, because the server fetches it nightly and that would be an SSRF hole.';

-- Which adapter reads store_domain. Detected when the partner saves the domain
-- rather than asked as a question — a shop owner knows their web address, not
-- necessarily which platform their agency built the site on.
alter table public.partners
  add column if not exists feed_platform text not null default 'shopify'
  check (feed_platform in ('shopify', 'woocommerce'));

comment on column public.partners.feed_platform is
  'Catalogue source for store_domain. Every existing partner is shopify, which is why that is the default.';

-- partner_products.source records which pipeline wrote a row, so it must name
-- the platform too. 'manual' stays the marker for hand-added products, which the
-- sync never touches.
alter table public.partner_products
  drop constraint if exists partner_products_source_check;
alter table public.partner_products
  add constraint partner_products_source_check
  check (source in ('manual', 'shopify', 'woocommerce'));

comment on column public.partner_products.source is
  'manual = added by hand in the partner panel, never touched by the sync. Anything else is the feed platform that imported it.';
