-- TradeDoubler merchant rows for the click-time affiliate layer.
--
-- These are programmes we're approved for but which publish NO product feed,
-- so they're monetized purely through the /out redirect: a user pastes a
-- merchant URL into a board, resolveMerchant() matches the host, and
-- buildDeeplink() rewrites it to a tracked TD link.
--
-- Deeplink format note: TradeDoubler uses PARENTHESIS syntax, not &key=value.
-- `url` must be lowercase and must come LAST — TD's parser is case- and
-- order-sensitive. The example row in 20260724090000_affiliate_layer.seed.sql
-- originally used the wrong (&-separated) form; it has been corrected too.
--
--   https://clk.tradedoubler.com/click?p(PROGRAM)a(AFFILIATE)epi(SUBID)url(TARGET)
--
-- {URL} is url-encoded by buildDeeplink(), which is what url(...) expects.
-- {PUBLISHER_ID} resolves from TRADEDOUBLER_AFFILIATE_ID (3492514) at click
-- time — it is deliberately NOT stored here (see affiliate_layer.sql:31-33).
--
-- Domains: storing the bare host is sufficient. candidateHosts() in
-- resolveMerchant.ts already tries the full host, the www-stripped host and
-- the registrable domain, so `pigu.lt` matches www, bare and any subdomain.
-- The www variants below are redundant but kept for readability.

begin;

-- Idempotent: re-running must not duplicate merchants. There is no unique
-- constraint on name/domains, so guard each insert explicitly.
insert into public.affiliate_merchants
  (name, domains, network, network_advertiser_id, deeplink_template,
   is_allowlisted, quality_tier)
select v.name, v.domains, 'tradedoubler', v.advertiser_id,
       'https://clk.tradedoubler.com/click?p({ADVERTISER_ID})a({PUBLISHER_ID})epi({SUB_ID})url({URL})',
       true, v.tier
from (values
  -- Largest LT marketplace — highest expected click volume of this set.
  ('Pigu.lt',      array['pigu.lt', 'www.pigu.lt'],           '380227', 3),
  ('4F LT',        array['4fstore.lt', 'www.4fstore.lt'],     '392834', 2),
  ('Dyson LT',     array['dyson.lt', 'www.dyson.lt'],         '361723', 2),
  ('About You LT', array['aboutyou.lt', 'www.aboutyou.lt'],   '403112', 2),
  ('Fera.lt',      array['fera.lt', 'www.fera.lt'],           '364984', 2)
) as v(name, domains, advertiser_id, tier)
where not exists (
  select 1 from public.affiliate_merchants m
  where m.network = 'tradedoubler'
    and m.network_advertiser_id = v.advertiser_id
);

commit;
