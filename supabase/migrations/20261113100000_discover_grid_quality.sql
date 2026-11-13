-- Discover grid quality: mixed order, no duplicates, less junk.
--
-- The design review (2026-11-12) found the grids under every page were the
-- weakest part of /idejos:
--   * 19 of the first 20 products were perfume. pos was gift_score order, and
--     gift_score is coarse by type (beauty p50 78, home 66), so one type wins.
--   * The same product twice: Modivo and Eavalyne (sister shops) list it with
--     the words in a different order; size variants within one shop too.
--   * "Technikos dovanos vyrui" opened on ink cartridges, heaters, fans, a 4G
--     router and BOSS belts (the tech pattern matched "Dron-Pa").

-- ---------------------------------------------------------------------------
-- 1. "dron" must be a drone ("dronas", "drono", "drone"), not "Dron-Pa";
--    "kamer" a camera, not TOMS "Kameron" shoes ("pusbačiai" are shoes); and
--    Notino's "Health & Beauty > … Skin Care" is beauty, not "garden" because
--    a face mist is "gėlių" (floral).

create or replace function public.classify_by_title(p_category text, p_name text)
returns text
language sql
immutable
as $function$
  select case
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(kvepal|parfum|perfume|eau de (parfum|toilette|cologne)|tualetinis vanduo|lūp[ųu] daž|makiaž|kremas|kremai|veido|veidui|plauk[ųu]|kosmetik|fragrance|health & beauty|skin care)' then 'beauty'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(bat[aųiø]|batel|pusbač|pusbac|sneaker|krosov|aulini|sandal|šlepet|slepet|loafer|mokasin|shoe|boot|kedai|espadril|basut|sportbač)' then 'shoes'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(rankin|kuprin|krepšy|krepsy|pinigin|backpack|wallet|handbag|lagamin|dėklas|deklas)' then 'bag'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(suknel|kelnės|kelnes|džins|dzins|striuk|palaidin|marškin|marskin|megztin|sijon|liemenėl|\mpaltas\M|švark|svark|kostium|džemper|dzemper|dress|shirt|jean|jacket|coat|sweater|trouser|\mskirts?\M|kardigan)' then 'clothing'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(kepur|šalik|salik|pirštin|pirstin)' then 'accessory'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(žaisl|zaisl|lego|konstruktor|lėl[ėe]|stalo žaidim|stalo zaidim|\mdėlion|\mdelion|pliušin|pliusin|puzzle)' then 'toys'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(ausin[ėe]|kolon[ėe]l|išmanus|ismanus|išmanieji|planšet|planset|telefon|kompiuter|nešiojam|nesiojam|monitor|klaviatūr|klaviatur|konsol|playstation|xbox|fotoaparat|\mkamer(a|os|ą|ų|u)?\M|vaizdo kamer|\mdron(as|ai|ų|u|ui|o|e|es)\M|\mdrones?\M|smartwatch)' then 'tech'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(virtuv[ėe]s ir stalo|puod(as|ai|ų|u)|keptuv|kavos aparat|kavamal|arbatin|taur[ėe]s|indų|stalo įrank|stalo irank|prieskoni|trintuv|virdul)' then 'kitchen'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(įrank|irank|gręžtuv|greztuv|atsuktuv|plaktuk|pjūkl|pjukl|suktuv|dirbtuv|proxxon|makita)' then 'tools'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(sporto prek|sprto prek|dvirat|riedut|riedlent|turizm|žygio|zygio|palapin|miegmaiš|miegmais|treniruokl|joga|fitnes|žvejyb|zvejyb|slidin)' then 'sport'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(gyvūn|gyvun|šuni|suni|katė|naguči|pašar|pasar)' then 'pets'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(sodo prek|sodinin|gėli[ųu]|geli[uu]|vazon|grilis|kepsnin)' then 'garden'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(žvak|zvak|vaz[ao]|namų interjer|namu interjer|pled|paveiksl|dekor|šviestuv|sviestuv|sieninis laikrod)' then 'home'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(laikrod|kepur|šalik|salik|pirštin|pirstin|dirž|dirz|kaklaraišt|akini|papuoš|papuos|apyrank|grandin[ėe]l|auskar|žied(as|ai|ą))' then 'accessory'
    else 'other'
  end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Not gifts: printer supplies, heaters, fans, network gear, card readers,
--    car navigation cards, endoscopes, steam cleaners, vacuum spares.
--    ("toneris", not "toner": facial toners are gifts.)

create or replace function public.is_giftable(p_category text, p_name text)
returns boolean
language sql
immutable
as $function$
  select not (coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* (
       '(padang|automobilin[ei] kilim|auto prek|autoprek|autoreikmen|tepal|variklio alyv|akumuliator|'
    || 'baldai|baldas|spinta|komod|sofa|fotelis|lova|čiužin|ciuzin|lentyn|'
    || 'kilimai|kilimėl|kilimel|patalyn|antklod|pagalv[ėe]|užuolaid|uzuolaid|rolet|karniz|'
    -- renovation MATERIALS, not the tools used to apply them
    || 'santechnik|apdail|statyb|radiator|vamzd|maišytuv|maisytuv|grindu dangos|'
    || 'dažai klijai|dazai klijai|tvoros vartu|glaist|cement|izoliacij|'
    || 'buitine chemij|valymo priemon|skalbimo milt|'
    || 'liemenėl|liemenel|kelnaitė|kelnaite|apatin|trumpik|bikini|maudym|tanga|glaustinuk|string|'
    || 'sauskeln|servetėl|servetel|tampon|įklot|iklot|intymios higienos|'
    || 'atsargin[ėe] dal|filtras|'
    -- 2026-11-13: household and office equipment that is never a present
    || 'eksploatacin|rašalo kaset|rasalo kaset|kasetė rašal|kasete rasal|kasetė lazerin|kasete lazerin|toneris|tonerio|'
    || 'šildytuv|sildytuv|ventiliator|konvektor|'
    || 'maršrutizator|marsrutizator|tinklo įrang|tinklo irang|\mrouter\M|\mmodem|'
    || 'card reader|kortelių skaitytuv|korteliu skaitytuv|navigacijos kortel|endoskop|'
    || 'garų valytuv|garu valytuv|siurblio maiš|siurblio mais|namu technika > priedai|namų technika > priedai)'))
    and not public.is_age_restricted(p_category, p_name, null);
$function$;

-- ---------------------------------------------------------------------------
-- 3. discover_products: one row per product, and a mixed "recommended" order.
--
--    dkey   brand + the name's distinct words, sorted, minus the brand's own
--           words: "Eavalyne: Rankinė Liu Jo AA6176 E1012 Ruda" and "Modivo:
--           Liu Jo Rankinė AA6176 E1012 Ruda" are one key. Colour stays in
--           the name, so colours stay apart. The cheapest offer wins.
--    pos    best product of each brand (and of each shop category) within
--           a type first (greatest of brand_rank, cat_rank),
--           then the types interleaved round-robin (type_rank), best first
--           within a round. A category page gets brand variety; a mixed page
--           gets type variety. 'other' (unclassified) comes 4x slower.
--
--    ~35 s for 262k rows; it runs inside the nightly import (service_role,
--    120 s statement timeout).

create or replace function public.discover_products_load()
returns integer
language plpgsql
security definer
set search_path to 'public'
set work_mem to '96MB'
set lock_timeout to '30s'
as $function$
declare
  n integer;
  cur char(1);
  t text;
begin
  perform pg_advisory_xact_lock(hashtext('rebuild_discover_products'));
  select active into cur from discover_products_state where only_row for update;
  t := 'discover_products_' || case when cur = 'a' then 'b' else 'a' end;

  execute format('truncate public.%I', t);
  execute format('drop index if exists public.%I, public.%I, public.%I, public.%I, public.%I, public.%I, public.%I',
    t || '_pos', t || '_type_pos', t || '_brand_pos', t || '_merchant_pos', t || '_price', t || '_discount', t || '_age_type_pos');

  execute format($q$
    insert into public.%I
      (id, product_name, brand_name, merchant_name, partner_id, price, rrp,
       discount_pct, image_url, deep_link, product_type, gender, audience, season,
       gift_score, pos)
    with base as (
      select p.*,
             lower(coalesce(p.brand_name, '')) || '|' || coalesce((
               select string_agg(distinct w, ' ' order by w)
                 from regexp_split_to_table(lower(public.nr_unaccent(p.product_name)), '[^a-z0-9]+') w
                where length(w) > 1
                  and position(w in lower(public.nr_unaccent(coalesce(p.brand_name, '')))) = 0
             ), p.id) as dkey
        from public.inspo_products p
       where p.in_stock
         and p.giftable
         and p.image_url is not null
         and p.deep_link is not null
         and p.price >= 10
    ),
    dedup as (
      select b.*, row_number() over (partition by dkey order by price, gift_score desc nulls last, id) as dup_rank
        from base b
    ),
    by_brand as (
      select d.*,
             row_number() over (
               partition by product_type, lower(coalesce(brand_name, ''))
               order by gift_score desc nulls last, sort_key, id) as brand_rank,
             -- The shop's own category too: every PS5 game has a different
             -- publisher, so brand alone let "pramogos namuose" fill a page.
             row_number() over (
               partition by product_type, coalesce(category_name, '')
               order by gift_score desc nulls last, sort_key, id) as cat_rank
        from dedup d
       where dup_rank = 1
    ),
    by_type as (
      select b.*, row_number() over (
               partition by product_type
               order by greatest(brand_rank, cat_rank), gift_score desc nulls last, sort_key, id) as type_rank
        from by_brand b
    )
    select id, product_name, brand_name, merchant_name, partner_id, price, rrp,
           discount_pct, image_url, deep_link, product_type, gender, audience, season,
           gift_score,
           row_number() over (
             order by type_rank * case when product_type = 'other' then 4 else 1 end,
                      gift_score desc nulls last, sort_key, id)::int
      from by_type
  $q$, t);
  get diagnostics n = row_count;

  update discover_products_state
     set building = case when cur = 'a' then 'b' else 'a' end, building_rows = n
   where only_row;
  return n;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Re-derive the rows the new patterns touch (the derive trigger recomputes
--    product_type and giftable on any update), then rebuild discover_products.
--    In prod this ran as one migration (2026-11-13, ~1 min, 261,709 -> 203,771
--    rows); the MCP tool reported a timeout but the transaction committed, so
--    check discover_products_state.rebuilt_at before re-running anything.

update public.inspo_products
   set product_name = product_name
 where search_norm ~ '(\mdron|kamer|pusbac|health & beauty|skin care|eksploatacin|rasalo kaset|kasete rasal|kasete lazerin|toneris|tonerio|sildytuv|ventiliator|konvektor|marsrutizator|tinklo irang|\mrouter|\mmodem|card reader|korteliu skaitytuv|navigacijos kortel|endoskop|garu valytuv|siurblio mais|namu technika > priedai)';

select public.rebuild_discover_products();
