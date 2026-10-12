-- DJI LT (TradeDoubler programme 407899): click-time only.
--
-- The programme publishes no product feed visible to our token (checked
-- 2026-10-09 against /1.0/productFeeds), so there is nothing to import into
-- inspo_products — DJI links pasted onto boards are monetised through /out,
-- same as Fera. Add a TD_FEED_PROFILES entry if a feed ever appears.
--
-- Landing domain is the official store, store.dji.com (LT region). Product
-- links also point at www.dji.com, so the registrable domain is listed too;
-- candidateHosts() matches subdomains through it.
insert into public.affiliate_merchants
  (name, domains, network, network_advertiser_id, deeplink_template,
   is_allowlisted, quality_tier)
select 'DJI LT',
       array['dji.com', 'store.dji.com', 'www.dji.com'],
       'tradedoubler',
       '407899',
       'https://clk.tradedoubler.com/click?p({ADVERTISER_ID})a({PUBLISHER_ID})epi({SUB_ID})url({URL})',
       true,
       2
where not exists (
  select 1 from public.affiliate_merchants m
  where m.network = 'tradedoubler'
    and m.network_advertiser_id = '407899'
);
