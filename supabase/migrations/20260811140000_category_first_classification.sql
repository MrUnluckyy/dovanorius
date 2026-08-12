-- Classify from the merchant's OWN taxonomy first; fall back to title matching.
--
-- 76% of the catalogue carries a real category (Modivo 98%, About You / Pigu /
-- 4F / Dyson 100%) and we were inferring product_type from titles anyway. That
-- inversion caused every substring bug: `kompiuter` making a laptop BAG into
-- tech, `lego` making a t-shirt into a toy, `monitor` making a boot into a
-- gadget. In each case the merchant had already said what the thing was.
--
-- Order of authority:
--   1. category_map        the merchant's category, mapped once to our buckets
--   2. classify_by_title   for the 24% with no category at all
--   3. merchant_default    only when the above yields 'other', for single-
--      vertical shops. Eavalyne (eobuwie) is footwear, Douglas is beauty; that
--      alone rescues 12,522 rows that were sitting unusable in 'other'. Last so
--      it never overrides a real signal — Eavalyne's 8,103 bags stay bags.
create table if not exists public.category_map (
  category_name text primary key,
  product_type  text not null,
  note          text,
  updated_at    timestamptz not null default now()
);
comment on table public.category_map is
  'Merchant category string -> product_type. Seeded by scripts/map-categories.ts; edit rows freely then re-derive. Authoritative, ahead of any title matching.';
alter table public.category_map enable row level security;
revoke all on public.category_map from anon, authenticated;

create table if not exists public.merchant_default_type (
  merchant_name text primary key,
  product_type  text not null,
  note          text
);
comment on table public.merchant_default_type is
  'Fallback bucket for single-vertical merchants publishing no category. Applied only when nothing else classified the row.';
insert into public.merchant_default_type (merchant_name, product_type, note) values
  ('Eavalyne LT', 'shoes',  'eobuwie — footwear retailer; 0% of rows carry a category'),
  ('Douglas LT',  'beauty', 'beauty retailer; 0% of rows carry a category')
on conflict (merchant_name) do update
  set product_type = excluded.product_type, note = excluded.note;
alter table public.merchant_default_type enable row level security;
revoke all on public.merchant_default_type from anon, authenticated;

-- The old regex, kept as the fallback and renamed so the entry point owns the
-- name and the priority order.
create or replace function public.classify_by_title(p_category text, p_name text)
returns text language sql immutable as $$
  select case
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(kvepal|parfum|perfume|eau de (parfum|toilette|cologne)|tualetinis vanduo|lūp[ųu] daž|makiaž|kremas|kremai|veido|plauk[ųu]|kosmetik|fragrance)' then 'beauty'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(bat[aųiø]|batel|sneaker|krosov|aulini|sandal|šlepet|slepet|loafer|mokasin|shoe|boot|kedai|espadril|basut|sportbač)' then 'shoes'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(rankin|kuprin|krepšy|krepsy|pinigin|backpack|wallet|handbag|lagamin|dėklas|deklas)' then 'bag'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(suknel|kelnės|kelnes|džins|dzins|striuk|palaidin|marškin|marskin|megztin|sijon|liemenėl|\mpaltas\M|švark|svark|kostium|džemper|dzemper|dress|shirt|jean|jacket|coat|sweater|trouser|\mskirts?\M|kardigan)' then 'clothing'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(žaisl|zaisl|lego|konstruktor|lėl[ėe]|stalo žaidim|stalo zaidim|dėlion|delion|pliušin|pliusin|puzzle)' then 'toys'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(ausin[ėe]|kolon[ėe]l|išmanus|ismanus|išmanieji|planšet|planset|telefon|kompiuter|nešiojam|nesiojam|monitor|klaviatūr|klaviatur|konsol|playstation|xbox|fotoaparat|kamer|dron|smartwatch)' then 'tech'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(virtuv[ėe]s ir stalo|puod(as|ai|ų|u)|keptuv|kavos aparat|kavamal|arbatin|taur[ėe]s|indų|stalo įrank|stalo irank|prieskoni|trintuv|virdul)' then 'kitchen'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(įrank|irank|gręžtuv|greztuv|atsuktuv|plaktuk|pjūkl|pjukl|suktuv|dirbtuv|proxxon|makita)' then 'tools'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(sporto prek|sprto prek|dvirat|riedut|riedlent|turizm|žygio|zygio|palapin|miegmaiš|miegmais|treniruokl|joga|fitnes|žvejyb|zvejyb|slidin)' then 'sport'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(gyvūn|gyvun|šuni|suni|katė|naguči|pašar|pasar)' then 'pets'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(sodo prek|sodinin|gėli[ųu]|geli[uu]|vazon|grilis|kepsnin)' then 'garden'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(žvak|zvak|vaz[ao]|namų interjer|namu interjer|pled|paveiksl|dekor|šviestuv|sviestuv|sieninis laikrod)' then 'home'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(laikrod|kepur|šalik|salik|pirštin|pirstin|dirž|dirz|kaklaraišt|akini|papuoš|papuos|apyrank|grandin[ėe]l|auskar|žied(as|ai|ą))' then 'accessory'
    else 'other'
  end;
$$;

-- STABLE, not IMMUTABLE: it reads two tables now. Fine for a BEFORE trigger,
-- which is its only caller.
create or replace function public.classify_product_type(
  p_category text, p_name text, p_merchant text default null
) returns text language plpgsql stable as $$
declare v_type text;
begin
  -- Only when the category is a NAME. Modivo publishes bare ids ("187", "212");
  -- mapping those produced `other` for 48k rows and overrode working
  -- classification, because a number carries no meaning to map.
  if coalesce(p_category,'') <> '' and p_category !~ '^[0-9]+$' then
    select product_type into v_type from public.category_map where category_name = p_category;
    if v_type is not null then return v_type; end if;
  end if;

  v_type := public.classify_by_title(p_category, p_name);

  if v_type = 'other' and coalesce(p_merchant,'') <> '' then
    select product_type into v_type from public.merchant_default_type where merchant_name = p_merchant;
    if v_type is null then v_type := 'other'; end if;
  end if;
  return v_type;
end $$;

create or replace function public.inspo_products_derive()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.skip_derive', true), '') = 'on' then return new; end if;
  if tg_op = 'INSERT'
     and public.is_age_restricted(new.category_name, new.product_name, new.brand_name) then
    return null;
  end if;
  new.product_type := public.classify_product_type(new.category_name, new.product_name, new.merchant_name);
  new.giftable     := public.is_giftable(new.category_name, new.product_name);
  new.gift_score   := public.compute_gift_score(new.brand_name, new.product_type, new.price,
                        new.discount_pct, new.product_name, new.gender, new.rrp);
  return new;
end $$;

-- `remont` was throwing away 3,800 tool products: Pigu files its whole tool
-- aisle under "namu remontas > irankiai", so a cordless drill was excluded like
-- a bag of plaster and "Meistrui" curated from 543 rows instead of 4,343.
-- Target the materials, not the word.
create or replace function public.is_giftable(p_category text, p_name text)
returns boolean language sql immutable as $$
  select not (coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* (
       '(padang|automobilin[ei] kilim|auto prek|autoprek|autoreikmen|tepal|variklio alyv|akumuliator|'
    || 'baldai|baldas|spinta|komod|sofa|fotelis|lova|čiužin|ciuzin|lentyn|'
    || 'kilimai|kilimėl|kilimel|patalyn|antklod|pagalv[ėe]|užuolaid|uzuolaid|rolet|karniz|'
    || 'santechnik|apdail|statyb|radiator|vamzd|maišytuv|maisytuv|grindu dangos|'
    || 'dažai klijai|dazai klijai|tvoros vartu|glaist|cement|izoliacij|'
    || 'buitine chemij|valymo priemon|skalbimo milt|'
    || 'liemenėl|liemenel|kelnaitė|kelnaite|apatin|trumpik|bikini|maudym|tanga|glaustinuk|string|'
    || 'sauskeln|servetėl|servetel|tampon|įklot|iklot|intymios higienos|'
    || 'atsargin[ėe] dal|filtras)'))
    and not public.is_age_restricted(p_category, p_name, null);
$$;

-- Explicit pagination: PostgREST caps responses at 1,000 rows on this project
-- and .range() does not lift it, so three mapping runs each reported success
-- while seeing only the first 1,000 of 2,778 categories.
create or replace function public.distinct_categories(
  p_limit integer default 1000, p_offset integer default 0
) returns table(category_name text, rows bigint)
language sql stable security definer set search_path = public as $$
  select category_name, count(*) from public.inspo_products
  where category_name is not null and category_name <> ''
  group by category_name order by count(*) desc, category_name
  limit p_limit offset p_offset;
$$;
revoke execute on function public.distinct_categories(integer, integer) from public;
grant execute on function public.distinct_categories(integer, integer) to service_role;

-- Re-derivation by keyset over the primary key. Clearing a marker column and
-- sweeping for it needed a sequential scan of 326k rows per batch and died in
-- the gateway every time; walking id ranges makes each batch an index read.
create or replace function public.rederive_inspo_range(
  p_where text default 'true', p_after text default '', p_batch integer default 2000
) returns table(last_id text, scanned integer, touched integer)
language plpgsql security definer set search_path = public as $$
declare v_ids text[]; v_last text; v_touched integer;
begin
  select array_agg(id order by id), max(id) into v_ids, v_last
  from (select id from public.inspo_products where id > p_after order by id limit p_batch) s;

  if v_ids is null then
    last_id := null; scanned := 0; touched := 0; return next; return;
  end if;

  execute format('update public.inspo_products set synced_at = synced_at
                   where id = any($1) and (%s)', p_where) using v_ids;
  get diagnostics v_touched = row_count;
  last_id := v_last; scanned := array_length(v_ids, 1); touched := v_touched;
  return next;
end $$;
revoke execute on function public.rederive_inspo_range(text, text, integer) from public;
grant execute on function public.rederive_inspo_range(text, text, integer) to service_role;

notify pgrst, 'reload schema';
