-- CJ merchant rows for the click-time affiliate layer.
--
-- The CJ feed import already stores tracked links for Discover products, but
-- a wish pasted from notino.lt / sizeer.lt / … went through /out untracked:
-- resolveMerchant() found no row for the host. These rows fix that.
--
-- CJ deeplink format (same as the feed's linkCode.clickUrl):
--
--   https://www.anrdoezrs.net/click-PID-LINKID?url=TARGET&sid=SUBID
--
-- PID is our website id, resolved from CJ_WEBSITE_ID (101900308) at click time
-- like the other networks' publisher ids. LINKID is the advertiser's text link
-- id, which differs per advertiser and is not the advertiser (CID) id, so it is
-- written into each template; network_advertiser_id keeps the CID for
-- reference. Link ids are the ones the live feed uses (inspo_products,
-- 2026-10-30). sid is CJ's sub id, reported back on commissions.
--
-- Bonami.lt and JD Sports are joined too but held from the feed, so we have no
-- link id for them yet; add them once one is known.

begin;

insert into public.affiliate_merchants
  (name, domains, network, network_advertiser_id, deeplink_template,
   is_allowlisted, quality_tier)
select v.name, v.domains, 'cj', v.advertiser_id,
       'https://www.anrdoezrs.net/click-{PUBLISHER_ID}-' || v.link_id || '?url={URL}&sid={SUB_ID}',
       true, v.tier
from (values
  ('Notino.lt',     array['notino.lt', 'www.notino.lt'],             '5835258', '15116518', 3),
  ('Sizeer.lt',     array['sizeer.lt', 'www.sizeer.lt'],             '6728089', '15816246', 2),
  ('Philips LT',    array['shop.philips.lt', 'www.shop.philips.lt'], '7336769', '17034673', 2),
  ('Zepter LT',     array['shop.zepter.lt'],                         '7341377', '17133191', 2),
  ('Electrolux LT', array['electrolux.lt', 'www.electrolux.lt'],     '7469933', '17106286', 2)
) as v(name, domains, advertiser_id, link_id, tier)
where not exists (
  select 1 from public.affiliate_merchants m
  where m.network = 'cj'
    and m.network_advertiser_id = v.advertiser_id
);

commit;
