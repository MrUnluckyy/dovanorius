-- CJ (Commission Junction) as a product-feed network (lib/feeds/cj.ts).
--
-- Only the two network checks change: the importer's staging and merge
-- functions are network-agnostic. Widening a CHECK leaves every existing row
-- valid.

alter table public.inspo_products drop constraint if exists inspo_products_network_check;
alter table public.inspo_products add constraint inspo_products_network_check
  check (network in ('awin', 'tradedoubler', 'cj', 'direct'));

alter table public.affiliate_merchants drop constraint if exists affiliate_merchants_network_check;
alter table public.affiliate_merchants add constraint affiliate_merchants_network_check
  check (network in ('awin', 'tradedoubler', 'cj', 'sovrn', 'direct'));
