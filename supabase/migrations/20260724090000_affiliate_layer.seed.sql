-- Example seed rows for affiliate_merchants (Phase 1 testing).
--
-- NOT a migration — run manually after editing the advertiser ids / domains to
-- match your approved Awin / TradeDoubler programs and direct partners.
-- Publisher ids are NOT stored here; they come from env at click time:
--   AWIN_PUBLISHER_ID, TRADEDOUBLER_AFFILIATE_ID, SOVRN_KEY.
--
-- Deeplink template placeholders substituted by buildDeeplink():
--   {URL} url-encoded target, {RAW_URL} raw, {ADVERTISER_ID}, {PUBLISHER_ID},
--   {SUB_ID}, {SOVRN_KEY}.

-- Awin advertiser (replace 12345 with the real awinmid).
insert into public.affiliate_merchants
  (name, domains, network, network_advertiser_id, deeplink_template,
   is_allowlisted, quality_tier)
values (
  'Example Awin Store',
  array['example-awin.lt', 'www.example-awin.lt'],
  'awin',
  '12345',
  'https://www.awin1.com/cread.php?awinmid={ADVERTISER_ID}&awinaffid={PUBLISHER_ID}&clickref={SUB_ID}&ued={URL}',
  true,
  2
);

-- TradeDoubler advertiser (replace 67890 with the real program id `p`).
insert into public.affiliate_merchants
  (name, domains, network, network_advertiser_id, deeplink_template,
   is_allowlisted, quality_tier)
values (
  'Example TradeDoubler Store',
  array['example-td.lt', 'www.example-td.lt'],
  'tradedoubler',
  '67890',
  'https://clk.tradedoubler.com/click?p={ADVERTISER_ID}&a={PUBLISHER_ID}&epi={SUB_ID}&url={URL}',
  true,
  2
);

-- Direct partner (Shopify store with its own ref param; no publisher id needed).
insert into public.affiliate_merchants
  (name, domains, network, deeplink_template, commission_rate,
   is_allowlisted, quality_tier)
values (
  'Example Direct Shopify Store',
  array['example-shop.lt', 'www.example-shop.lt'],
  'direct',
  '{RAW_URL}?ref=dovanorius&sub={SUB_ID}',
  12.00,
  true,
  3
);

-- Sovrn long-tail fallback is configured via env, not a row:
--   SOVRN_KEY=...
--   SOVRN_DEEPLINK_TEMPLATE=https://redirect.viglink.com/?key={SOVRN_KEY}&u={URL}&opt=true
