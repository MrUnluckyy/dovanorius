-- Discovery overhaul: an audience axis, a searchable text column, and two
-- classifier fixes.
--
-- Three separate faults made browsing worse than the catalogue behind it:
--
-- 1. `product_type` answered two questions at once — *what is this* (shoes,
--    clothing, tech) and *who is it for* (toys ≈ kids). A child's t-shirt is
--    `clothing`, a child's sneaker is `shoes`, a child's bike is `sport`, so
--    the "Toys" pill was the only door to anything child-related: 2,064 rows
--    out of the ~17,000 the feed actually carries. Meanwhile those same 17,000
--    rows were served to *adults*, because kids products are deliberately left
--    `gender = null` (see classifyGender in lib/feeds/classify.ts) and the
--    audience filter keeps nulls by design. One missing dimension, two bugs:
--    an empty kids section and a 12%-children's-clothing adult feed.
--
-- 2. Search was `ilike '%q%'` over `product_name` alone — no diacritic folding
--    ("zaislai" found 0 of the 12 "žaislai" rows), no multi-term matching
--    ("lego duplo" found 0, "duplo" found 20), and brand and category were not
--    searched at all. Folding at query time is not an option: `unaccent()` in
--    the predicate cannot use the trigram index, and the query ran for over six
--    minutes before being killed. The data has to carry the folded copy.
--
-- 3. Two classifier misfires, both from unanchored substrings.
--
-- The audience vocabulary is taken from the merchants' own breadcrumbs, which
-- are far better structured than the title-keyword guessing that replaced them:
-- About You nests `Vaikams - Berniukams - Paaugliai (140-176 cm)` (kids > boys
-- > teens), 4F leads with `Berniukai` / `Mergaitės`, and Pigu with
-- `vaikams ir kudikiams`. That is an explicit, merchant-maintained age signal
-- the classifier never read.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

-- Both are plain nullable columns with no default, so this is a metadata-only
-- change. It matters here: `inspo_products` carries a GIN trigram index, and a
-- rewrite of the whole table exceeds the statement timeout — the same wall the
-- gift_score rollout hit, which is why that one is a trigger plus a batched
-- backfill rather than a generated column. This follows that pattern.
alter table public.inspo_products
  add column if not exists audience text,
  add column if not exists search_norm text;

-- NOT VALID keeps this metadata-only too; every existing row is NULL and so
-- trivially conformant, and the trigger below is the only writer.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inspo_products_audience_check'
  ) then
    alter table public.inspo_products
      add constraint inspo_products_audience_check
      check (audience in ('kid', 'teen', 'adult')) not valid;
  end if;
end $$;

comment on column public.inspo_products.audience is
  'Who the product is for, independent of gender: kid | teen | adult. Derived by classify_audience() in the inspo_products_derive trigger — never write to it directly.';

comment on column public.inspo_products.search_norm is
  'Lowercased, unaccented "product_name brand_name category_name" for diacritic-insensitive search. Derived by the inspo_products_derive trigger. Clients must fold the search term the same way (utils/helpers/search.ts foldForSearch).';

-- ---------------------------------------------------------------------------
-- 2. Audience classification
-- ---------------------------------------------------------------------------

create or replace function public.classify_audience(
  p_category text,
  p_name text,
  p_merchant text default null,
  p_suitable_for text default null
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $function$
  -- Everything is folded first, so each pattern below is written once in
  -- unaccented form: "kūdikiams" and "kudikiams" (Pigu writes it both ways),
  -- "Mergaitėms" and "mergaitems" all collapse to one spelling.
  with sig as (
    select
      lower(public.nr_unaccent(
        coalesce(p_category, '') || ' ' || coalesce(p_suitable_for, ''))) as cat,
      lower(public.nr_unaccent(coalesce(p_name, ''))) as nm
  )
  select case
    -- Teen is tested before kid, and the category before the title, because
    -- About You's breadcrumb carries BOTH tokens — "Vaikams - Berniukams -
    -- Paaugliai (140-176 cm)" is a teenager's shelf nested under the kids
    -- department. The narrower signal has to win or every teen row reads as a
    -- small child's. The cm ranges are About You's own size bands.
    when (select cat from sig) ~ '(\mpaaugl|\mteens?\M|140-176)' then 'teen'
    when (select cat from sig) ~ '(\mvaik(?!in)|\mkudik|\mberniuk|\mmergait|\mkids?\M|\mchild|\mbab(y|ies)\M|\minfant|\mtoddler|92-140)' then 'kid'

    -- Single-vertical kids merchants, for the rows where the breadcrumb is a
    -- bare product family ("Barškučiai ir kramtukai") with no audience in it.
    when coalesce(p_merchant, '') in ('IQ Žaislai', 'mideer') then 'kid'

    -- Title, last and lowest-confidence.
    when (select nm from sig) ~ '(\mpaaugl|\mteens?\M)' then 'teen'
    when (select nm from sig) ~ '(\mvaik(?!in)|\mkudik|\mberniuk|\mmergait|\mkids?\M|\mchild|\minfant|\mtoddler)' then 'kid'

    else 'adult'
  end;
$function$;

comment on function public.classify_audience(text, text, text, text) is
  'kid | teen | adult, from the merchant breadcrumb first and the title last. Anchors are load-bearing. "vaik(?!in)": vaikas is a child but vaikinas is a young man. Bare "baby" is trusted only in a breadcrumb, never in a title, where it is a cosmetics shade ("Blush Baby") or a product line ("PINKO Puff Baby") far more often than a real infant product.';

-- Kids breadcrumbs name the child's gender outright ("Vaikams - Mergaitėms",
-- "Berniukai > Apranga"), which the importer throws away: classifyGender
-- returns null for anything kid-shaped, reasoning that tagging a girl's coat
-- `female` would serve children's clothing to someone shopping "for her". With
-- audience as its own axis that risk is gone — an adult feed filters to
-- audience='adult' — so the gender can be kept, and "a gift for a 7-year-old
-- girl" becomes answerable.
create or replace function public.classify_kid_gender(p_category text, p_name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $function$
  with sig as (
    select lower(public.nr_unaccent(
      coalesce(p_category, '') || ' ' || coalesce(p_name, ''))) as t
  )
  select case
    when (select t from sig) ~ '(\mberniuk|\mboys?\M)' then 'male'
    when (select t from sig) ~ '(\mmergait|\mgirls?\M)' then 'female'
    else null
  end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Classifier fixes
-- ---------------------------------------------------------------------------

-- Two unanchored substrings, both found by reading what the shelves actually
-- served:
--
--  * `delion` matched "Dandelion" — every Benefit Dandelion cosmetic was filed
--    as a jigsaw puzzle, and one of them ranked top-10 in Toys. Anchored to a
--    word start now, which "danDELION" no longer satisfies.
--
--  * A LEGO-branded hat is a hat. The `lego` keyword outranked the headwear
--    keyword because `accessory` is the last branch and `toys` an early one, so
--    LEGO hats, ski gloves and scarves filled the Toys shelf — and being
--    branded, `compute_gift_score` awards them +18 and the `toys` bucket a
--    further +22 against `clothing`'s +6, which floated them to the very top.
--    Only 22 rows, but they were the first thing anyone saw under Toys.
--    Headwear/gloves/scarves join the concrete-object tier that already exists
--    for exactly this ("a laptop bag is a bag; a LEGO t-shirt is a t-shirt").
create or replace function public.classify_by_title(p_category text, p_name text)
returns text
language sql
immutable
as $function$
  select case
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(kvepal|parfum|perfume|eau de (parfum|toilette|cologne)|tualetinis vanduo|lūp[ųu] daž|makiaž|kremas|kremai|veido|plauk[ųu]|kosmetik|fragrance)' then 'beauty'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(bat[aųiø]|batel|sneaker|krosov|aulini|sandal|šlepet|slepet|loafer|mokasin|shoe|boot|kedai|espadril|basut|sportbač)' then 'shoes'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(rankin|kuprin|krepšy|krepsy|pinigin|backpack|wallet|handbag|lagamin|dėklas|deklas)' then 'bag'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(suknel|kelnės|kelnes|džins|dzins|striuk|palaidin|marškin|marskin|megztin|sijon|liemenėl|\mpaltas\M|švark|svark|kostium|džemper|dzemper|dress|shirt|jean|jacket|coat|sweater|trouser|\mskirts?\M|kardigan)' then 'clothing'
    -- Worn accessories, promoted above `toys` so a brand name cannot outvote
    -- the noun. Sits below `clothing` so a garment still wins outright.
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(kepur|šalik|salik|pirštin|pirstin)' then 'accessory'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(žaisl|zaisl|lego|konstruktor|lėl[ėe]|stalo žaidim|stalo zaidim|\mdėlion|\mdelion|pliušin|pliusin|puzzle)' then 'toys'
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
$function$;

-- mideer is a children's arts-and-crafts brand whose breadcrumbs are bare
-- product families ("Arts & Crafts", "Building Blocks", "HUGZ"), so 168 of its
-- 257 rows landed in `other` — a bucket no category pill reaches, making the
-- whole brand unreachable.
insert into public.merchant_default_type (merchant_name, product_type, note)
values ('mideer', 'toys', 'children''s arts-and-crafts brand; breadcrumbs are bare product families with no vertical in them')
on conflict (merchant_name) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Derivation trigger
-- ---------------------------------------------------------------------------

create or replace function public.inspo_products_derive()
returns trigger
language plpgsql
as $function$
begin
  if coalesce(current_setting('app.skip_derive', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT'
     and public.is_age_restricted(new.category_name, new.product_name, new.brand_name) then
    return null;
  end if;

  new.product_type := public.classify_product_type(
    new.category_name, new.product_name, new.merchant_name);
  new.giftable     := public.is_giftable(new.category_name, new.product_name);

  new.audience := public.classify_audience(
    new.category_name, new.product_name, new.merchant_name, new.suitable_for);

  -- Only fills a gap, never overrides: the importer stays the authority on
  -- gender for adult rows, and it only ever leaves kids rows null.
  if new.audience in ('kid', 'teen') and new.gender is null then
    new.gender := public.classify_kid_gender(new.category_name, new.product_name);
  end if;

  -- Brand and category join the name so that "nike" reaches rows whose title
  -- omits the brand, and a Lithuanian query like "zaislai" reaches Pigu's
  -- "zaislai ir zaidimai vaikams" shelf even when no title says it.
  new.search_norm := lower(public.nr_unaccent(
    concat_ws(' ', new.product_name, new.brand_name, new.category_name)));

  new.gift_score := public.compute_gift_score(
    new.brand_name, new.product_type, new.price, new.discount_pct,
    new.product_name, new.gender, new.rrp);

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------------

-- Same access pattern as the name column it supersedes: ilike '%term%', which
-- only a trigram index can serve. Each search term becomes its own ILIKE, so
-- this index is hit once per word in the query.
create index if not exists inspo_products_search_norm_trgm_idx
  on public.inspo_products using gin (search_norm public.gin_trgm_ops);

-- Browsing is now audience-first — every grid query pins an audience before it
-- narrows further — so the audience leads the key. Mirrors the existing
-- (product_type, gift_score, sort_key, id) index one level up.
create index if not exists inspo_products_audience_type_giftscore_idx
  on public.inspo_products (audience, product_type, gift_score desc, sort_key, id)
  where giftable;

create index if not exists inspo_products_audience_giftscore_idx
  on public.inspo_products (audience, gift_score desc, sort_key, id)
  where giftable;

-- Lets the backfill below find its next batch by index rather than by scanning
-- an ever-longer already-done prefix. Drops to nothing once the drain finishes.
create index if not exists inspo_products_discover_backfill_idx
  on public.inspo_products (id) where search_norm is null;

-- ---------------------------------------------------------------------------
-- 6. Backfill
-- ---------------------------------------------------------------------------

-- Touching a row re-fires the trigger, which is what actually computes the new
-- columns. Batched because the GIN trigram index makes a single 160k-row update
-- run past the statement timeout. One drain covers both new columns and picks
-- up the reclassification from section 3 at the same time.
create or replace function public.backfill_inspo_discover(p_batch integer default 2000)
returns integer
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_ids text[];
  v_n integer;
begin
  select array_agg(id) into v_ids
  from (
    select id from public.inspo_products where search_norm is null limit p_batch
  ) s;

  if v_ids is null then return 0; end if;

  update public.inspo_products set synced_at = synced_at where id = any(v_ids);
  get diagnostics v_n = row_count;
  return v_n;
end $function$;

comment on function public.backfill_inspo_discover(integer) is
  'Drains rows with a null search_norm by touching them so inspo_products_derive recomputes. Returns rows touched; 0 means done. Driven by scripts/backfill-discover.ts.';
