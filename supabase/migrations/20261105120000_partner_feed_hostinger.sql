-- Hostinger Website Builder stores as a third partner catalogue source.
--
-- Same model as Shopify and WooCommerce: the partner gives a bare domain and
-- the adapter (lib/partner-feeds/hostinger.ts) works out the rest. Only the
-- check constraints that enumerate platforms need widening.
alter table public.partners
  drop constraint if exists partners_feed_platform_check;
alter table public.partners
  add constraint partners_feed_platform_check
  check (feed_platform in ('shopify', 'woocommerce', 'hostinger'));

alter table public.partner_products
  drop constraint if exists partner_products_source_check;
alter table public.partner_products
  add constraint partner_products_source_check
  check (source in ('manual', 'shopify', 'woocommerce', 'hostinger'));
