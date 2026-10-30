-- Awin merchant rows for the click-time affiliate layer.
--
-- Douglas was the only Awin row, so wishes pasted from the other programmes we
-- have joined went through /out untracked. iHerb has no product feed with us;
-- Modivo and Eavalyne do, but their Discover links don't cover pasted wishes.
-- The Douglas template is reused: {PUBLISHER_ID} resolves from
-- AWIN_PUBLISHER_ID at click time, clickref carries our sub id.
--
-- Advertiser ids are from the Awin API (programmes?relationship=joined,
-- 2026-10-30). iHerb's programme is "iHerb EUR" on iherb.com; candidateHosts()
-- matches the registrable domain, so lt./www. subdomains resolve too.

begin;

insert into public.affiliate_merchants
  (name, domains, network, network_advertiser_id, deeplink_template,
   is_allowlisted, quality_tier)
select v.name, v.domains, 'awin', v.advertiser_id,
       'https://www.awin1.com/cread.php?awinmid={ADVERTISER_ID}&awinaffid={PUBLISHER_ID}&clickref={SUB_ID}&ued={URL}',
       true, v.tier
from (values
  ('iHerb',       array['iherb.com', 'www.iherb.com'],       '76734',  2),
  ('Modivo LT',   array['modivo.lt', 'www.modivo.lt'],       '117515', 2),
  ('Eavalyne LT', array['eavalyne.lt', 'www.eavalyne.lt'],   '117523', 2)
) as v(name, domains, advertiser_id, tier)
where not exists (
  select 1 from public.affiliate_merchants m
  where m.network = 'awin'
    and m.network_advertiser_id = v.advertiser_id
);

commit;
