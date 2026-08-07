-- Discover relevance foundation: stop serving a random product dump.
--
-- Three problems, in order of damage:
--   1. `sort_key` defaults to random(), so "Recommended" was a uniform random
--      draw over 328k rows. Page one served a toy train, an EV charging cable,
--      a dining chair and a bikini top. `gift_score` replaces it as the default
--      ordering; sort_key survives only as the tiebreaker so equal-quality
--      items still rotate.
--   2. 35% of rows were product_type='other' — the whole non-fashion side
--      (toys, tools, tech, kitchen) had no bucket, so it could not be browsed,
--      shelved, or retrieved by the gift engine.
--   3. Nothing distinguished a gift from a tyre.
--
-- Derivation lives in SQL rather than the importer because a BEFORE trigger
-- keeps AWIN and TradeDoubler rows consistent without a code deploy, and
-- because a generated column would have forced a whole-table rewrite in one
-- transaction (which timed out — inspo_products carries a GIN trigram index).
create or replace function public.classify_product_type(p_category text, p_name text)
returns text language sql immutable as $$
  select case
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(kvepal|parfum|perfume|lūp[ųu] daž|makiaž|kremas|kremai|veido|plauk[ųu]|kosmetik|beauty|fragrance|grozis|grožis)' then 'beauty'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(žaisl|zaisl|lego|konstruktor|lėl[ėe]|lel[ei]|stalo žaidim|stalo zaidim|dėlion|delion|pliušin|pliusin|puzzle)' then 'toys'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(ausin[ėe]|kolon[ėe]l|išmanus|ismanus|planšet|planset|telefon|kompiuter|nešiojam|nesiojam|monitor|klaviatūr|klaviatur|konsol|playstation|xbox|fotoaparat|kamer|dron|smartwatch|laikrod)' then 'tech'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(virtuv[ėe]s ir stalo|puod(as|ai|ų|u)|keptuv|kavos aparat|kavamal|arbatin|taur[ėe]s|indų|stalo įrank|stalo irank|prieskoni|trintuv|virdul)' then 'kitchen'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(įrank|irank|gręžtuv|greztuv|atsuktuv|plaktuk|pjūkl|pjukl|suktuv|dirbtuv|proxxon|makita)' then 'tools'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(sporto prek|sprto prek|dvirat|riedut|riedlent|turizm|žygio|zygio|palapin|miegmaiš|miegmais|treniruokl|joga|fitnes|žvejyb|zvejyb|slidin)' then 'sport'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(gyvūn|gyvun|šuni|suni|katė|naguči|pašar|pasar)' then 'pets'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(sodo prek|sodinin|gėli[ųu]|geli[uu]|vazon|grilis|kepsnin)' then 'garden'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(žvak|zvak|vaz[ao]|namų interjer|namu interjer|pled|paveiksl|dekor|šviestuv|sviestuv)' then 'home'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(bat[aųiø]|batel|sneaker|krosov|aulini|sandal|šlepet|slepet|loafer|mokasin|shoe|boot|kedai|espadril|basut)' then 'shoes'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(rankin|kuprin|krepšy|krepsy|pinigin|backpack|wallet|handbag|lagamin)' then 'bag'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(suknel|kelnės|kelnes|džins|dzins|striuk|palaidin|marškin|marskin|megztin|sijon|liemenėl|\mpaltas\M|švark|svark|kostium|džemper|dzemper|dress|shirt|jean|jacket|coat|sweater|trouser|\mskirts?\M|kardigan|sportbač)' then 'clothing'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(kepur|šalik|salik|pirštin|pirstin|dirž|dirz|kaklaraišt|akini|papuoš|papuos|apyrank|grandin[ėe]l|auskar|žied(as|ai|ą))' then 'accessory'
    else 'other'
  end;
$$;

-- NB `~*` binds tighter than `||`, so a concatenated pattern must be
-- parenthesised or the NOT receives text instead of boolean.
create or replace function public.is_giftable(p_category text, p_name text)
returns boolean language sql immutable as $$
  select not (coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* (
       '(padang|automobilin[ei] kilim|auto prek|autoprek|autoreikmen|tepal|variklio alyv|akumuliator|'
    || 'baldai|baldas|spinta|komod|sofa|fotelis|lova|čiužin|ciuzin|lentyn|'
    || 'kilimai|kilimėl|kilimel|patalyn|antklod|pagalv[ėe]|užuolaid|uzuolaid|rolet|karniz|'
    || 'santechnik|remont|apdail|statyb|radiator|vamzd|maišytuv|maisytuv|'
    || 'buitine chemij|valymo priemon|skalbimo milt|'
    || 'liemenėl|liemenel|kelnaitė|kelnaite|apatin|trumpik|bikini|maudym|tanga|glaustinuk|'
    || 'sauskeln|servetėl|servetel|atsargin[ėe] dal|filtras)'));
$$;

create or replace function public.compute_gift_score(
  p_brand text, p_type text, p_price numeric, p_discount numeric,
  p_name text, p_gender text, p_rrp numeric
) returns integer language sql immutable as $$
  select (case when coalesce(p_brand,'') <> '' then 18 else 0 end)
       + (case
            when p_type in ('toys','tech','beauty','kitchen','tools','sport','garden','pets') then 22
            when p_type in ('home','bag','accessory') then 16
            when p_type in ('shoes','clothing') then 6
            else 0 end)
       + (case
            when p_price >= 15 and p_price <= 120 then 22
            when p_price >= 10 and p_price <= 250 then 11
            else 0 end)
       + (case when p_discount between 5 and 70 then 9 else 0 end)
       + (case when char_length(coalesce(p_name,'')) between 20 and 90 then 10 else 0 end)
       + (case when p_gender is not null then 6 else 0 end)
       + (case when p_rrp is not null then 3 else 0 end);
$$;

-- Nullable, no default → instant, no table rewrite.
alter table public.inspo_products add column if not exists giftable boolean;
alter table public.inspo_products add column if not exists gift_score integer;

comment on column public.inspo_products.giftable is
  'False for things nobody gifts (tyres, furniture, bedding, renovation, cleaning, underwear). Discover browse and every shelf filter on this.';
comment on column public.inspo_products.gift_score is
  'Additive giftability score; the default discover ordering (desc), tiebroken by sort_key so equal-quality items rotate. Replaces the random() sort_key default.';

create or replace function public.inspo_products_derive()
returns trigger language plpgsql as $$
begin
  new.product_type := public.classify_product_type(new.category_name, new.product_name);
  new.giftable     := public.is_giftable(new.category_name, new.product_name);
  new.gift_score   := public.compute_gift_score(
    new.brand_name, new.product_type, new.price, new.discount_pct,
    new.product_name, new.gender, new.rrp);
  return new;
end;
$$;

drop trigger if exists inspo_products_derive_trg on public.inspo_products;
create trigger inspo_products_derive_trg
  before insert or update on public.inspo_products
  for each row execute function public.inspo_products_derive();
