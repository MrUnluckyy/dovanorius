-- Attribute outbound clicks to direct partners.
--
-- Partner shops have no affiliate network, so /out tags their links itself
-- (utm_* + nr_click=<sub_id>) and records which partner the click went to.
-- Shopify stores the landing URL on every order, which is how a later order
-- can be matched back to sub_id (step 2).
--
-- product_id is the served inspo_products id ('partner:<uuid>') when the click
-- came from Discover. No FK: products are pruned and retracted, the click
-- history must outlive them.
alter table public.affiliate_clicks
  add column if not exists partner_id uuid references public.partners(id) on delete set null,
  add column if not exists product_id text;

create index if not exists affiliate_clicks_partner_idx
  on public.affiliate_clicks (partner_id, created_at desc)
  where partner_id is not null;

create index if not exists affiliate_clicks_sub_id_idx
  on public.affiliate_clicks (sub_id);
