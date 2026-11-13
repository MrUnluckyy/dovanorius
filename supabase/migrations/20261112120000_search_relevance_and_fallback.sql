-- Search: word-start matching, category-aware ranking, and a fallback for
-- searches that find nothing. On top of search_products (20261001090000).
--
-- 1. Match each word at the START of a word, not anywhere in the string.
--    Substring matching made "dronas" (stem "dron") find Geox "Ciberdron"
--    sandals. The trigram index serves `~ '\m<stem>'` as well as it served
--    LIKE (12 ms vs 8 ms for "kvepalai moterims", warm).
--
-- 2. Rank a match in the category or brand above one in the name alone. DJI
--    calls a drone "DJI Flip Fly More Combo"; only its category says
--    "Dronai", so the old name-only score put "BOSS Dron-Pa" belts first, and
--    Pigu's "charger for Dyson V6" sat level with Dyson's own products.
--
-- 3. search_fallback(): a third of searches found nothing (405 of 1,193 since
--    2 Oct). Instead of an empty page: fix the spelling, else drop words until
--    something matches ("kayali kvepalai" -> "kvepalai"), else say so and
--    show popular gifts.
--
-- search_products keeps its signature (CREATE OR REPLACE), so noriuto-app and
-- PostgREST see no change. Rowtype functions bind by OID: never drop it.

-- ---------------------------------------------------------------------------
-- Shared pieces, so search_products and search_fallback can't drift apart.

-- Words of a query, in order, deduplicated, as typed (diacritics kept for
-- display) alongside their folded stem for matching. Words under 3 letters
-- are dropped, as before ("su", "ir").
create or replace function public.search_words(p_q text)
returns table (word text, stem text)
language sql
immutable
set search_path = public
as $function$
  select w, s
    from (
      select w,
             search_stem(regexp_replace(lower(nr_unaccent(w)), '[^a-z0-9]+', '', 'g')) as s,
             min(ord) as ord
        from regexp_split_to_table(coalesce(left(p_q, 100), ''), '[^[:alnum:]ąčęėįšųūžĄČĘĖĮŠŲŪŽ]+')
             with ordinality as t(w, ord)
       group by w
    ) x
   where length(s) >= 3
   order by ord
$function$;

-- The filter half of the WHERE clause. $1..$8 are, in order: product_type,
-- brand, merchant, price_min, price_max, gender, hide_season, on_sale.
create or replace function public.search_filter_sql()
returns text
language sql
immutable
as $function$
  select '
    and p.in_stock and p.giftable
    and p.image_url is not null and p.deep_link is not null and p.price is not null
    and ($1 is null or p.product_type = $1)
    and ($2 is null or p.brand_name = $2)
    and ($3 is null or p.merchant_name = $3)
    and ($4 is null or p.price >= $4)
    and ($5 is null or p.price <= $5)
    and ($6 is null or $6 not in (''male'', ''female'') or p.gender is null
         or p.gender <> (case $6 when ''male'' then ''female'' else ''male'' end))
    and ($7 is null or p.season is null or p.season <> $7)
    and (not $8 or (p.discount_pct > 0 and p.discount_pct <= 85))'
$function$;

-- Every stem must start a word somewhere in search_norm (name + brand +
-- category). Stems are [a-z0-9] only, and %L quotes them regardless.
create or replace function public.search_match_sql(p_stems text[])
returns text
language sql
immutable
as $function$
  select coalesce(string_agg(format('p.search_norm ~ %L', '\m' || s), ' and '), 'false')
    from unnest(p_stems) s
$function$;

-- ---------------------------------------------------------------------------
-- search_products: same signature and behaviour, new matching and score.

create or replace function public.search_products(
  p_q            text,
  p_product_type text    default null,
  p_brand        text    default null,
  p_merchant     text    default null,
  p_price_min    numeric default null,
  p_price_max    numeric default null,
  p_gender       text    default null,
  p_hide_season  text    default null,
  p_on_sale      boolean default false,
  p_sort         text    default 'relevance',
  p_limit        integer default 24,
  p_offset       integer default 0,
  p_source       text    default null   -- 'web' | 'app' | 'fallback' (not logged)
)
returns setof public.inspo_products
language plpgsql
volatile
set search_path = public
as $function$
declare
  v_tokens  text[];
  v_where   text;
  v_matches integer;
  v_rows    integer;
  v_limit   integer := least(greatest(coalesce(p_limit, 24), 1), 100);
  v_offset  integer := greatest(coalesce(p_offset, 0), 0);
  v_order   text;
begin
  select array_agg(distinct stem) into v_tokens from search_words(p_q);

  if v_tokens is null then
    return;
  end if;

  v_where := search_match_sql(v_tokens) || search_filter_sql();

  v_order := case p_sort
    when 'price_asc'  then 'p.price asc, p.id'
    when 'price_desc' then 'p.price desc, p.id'
    when 'discount'   then 'p.discount_pct desc, p.id'
    else 'p.gift_score desc, p.sort_key, p.id'
  end;

  if coalesce(p_sort, 'relevance') not in ('price_asc', 'price_desc', 'discount') then
    execute format('select count(*) from (select 1 from inspo_products p where %s limit 601) s', v_where)
      into v_matches
      using p_product_type, p_brand, p_merchant, p_price_min, p_price_max, p_gender, p_hide_season, coalesce(p_on_sale, false);

    if v_matches <= 600 then
      -- Per word, by WHERE it starts a word: category or brand 1.0 (it says
      -- what the product is, or who makes it), name only 0.8 (names carry
      -- model codes like "BOSS Dron-Pa" and mentions like "charger for Dyson
      -- V6"), name AND category/brand 1.2. Then the "intent" share (how much
      -- of the result set shares this row's product_type) and a little
      -- gift_score, which must stay small: a BOSS belt scores 81, a drone 59.
      return query execute format($q$
        with m as (
          select p.id, p.product_type, p.gift_score, p.sort_key,
                 lower(nr_unaccent(p.product_name)) as fn,
                 lower(nr_unaccent(coalesce(p.brand_name, ''))) as fb,
                 lower(nr_unaccent(coalesce(p.category_name, ''))) as fc
            from inspo_products p
           where %s
        ),
        intent as (
          select product_type, count(*)::float / sum(count(*)) over () as share
            from m group by product_type
        ),
        scored as (
          select m.*,
                 (select avg(case
                                when m.fn ~ ('\m' || t) and (m.fc ~ ('\m' || t) or m.fb ~ ('\m' || t)) then 1.2
                                when m.fc ~ ('\m' || t) or m.fb ~ ('\m' || t) then 1.0
                                else 0.8
                              end)
                    from unnest($9) t)
               + 1.5 * coalesce(i.share, 0)
               + 0.5 * coalesce(m.gift_score, 0) / 100.0 as rank
            from m left join intent i using (product_type)
        )
        select p.*
          from (select id, rank, sort_key from scored
                 order by rank desc, sort_key, id
                 limit %s offset %s) r
          join inspo_products p on p.id = r.id
         order by r.rank desc, r.sort_key, r.id
      $q$, v_where, v_limit, v_offset)
      using p_product_type, p_brand, p_merchant, p_price_min, p_price_max, p_gender, p_hide_season, coalesce(p_on_sale, false), v_tokens;
    end if;
  end if;

  if v_matches is null or v_matches > 600 then
    return query execute format(
      'select p.* from inspo_products p where %s order by %s limit %s offset %s',
      v_where, v_order, v_limit, v_offset)
      using p_product_type, p_brand, p_merchant, p_price_min, p_price_max, p_gender, p_hide_season, coalesce(p_on_sale, false);
  end if;
  get diagnostics v_rows = row_count;

  -- A fallback search is the page's own retry, not something the visitor
  -- typed; the original zero-result search is already logged.
  if v_offset = 0 and p_source is distinct from 'fallback' then
    perform log_search(p_q, coalesce(v_matches, v_rows), p_source);
  end if;
end
$function$;

comment on function public.search_products is
  'Diacritic-insensitive product search: every word must start a word of name/brand/category; relevance ranking (<=600 matches) or gift_score order (broader). Logs page-1 searches unless p_source = fallback. Shared by web and noriuto-app. See 20261112120000.';

grant execute on function public.search_products to anon, authenticated;

-- ---------------------------------------------------------------------------
-- search_fallback: what to show when search_products found nothing.
--
-- Returns {mode, q, dropped}:
--   corrected  q = the spelling-fixed query, which has results
--   relaxed    q = the largest subset of the words that still has results
--              (most results among equal-size subsets); dropped = the rest
--   popular    nothing matches any word: show popular gifts instead
-- Same filters as search_products, so "under €30 for him" stays that.

create or replace function public.search_fallback(
  p_q            text,
  p_product_type text    default null,
  p_brand        text    default null,
  p_merchant     text    default null,
  p_price_min    numeric default null,
  p_price_max    numeric default null,
  p_gender       text    default null,
  p_hide_season  text    default null,
  p_on_sale      boolean default false
)
returns jsonb
language plpgsql
volatile -- calls search_correct
set search_path = public
as $function$
declare
  v_fixed   text;
  v_words   text[];
  v_stems   text[];
  v_use_w   text[] := '{}';
  v_use_s   text[] := '{}';
  v_n       integer;
  v_count   integer;
  v_best    integer;
  v_bmask   integer;
  v_size    integer;
  v_mask    integer;
  v_sel     text[];
  i         integer;
begin
  -- 1. Spelling. search_correct only rewrites words the catalogue lacks.
  v_fixed := search_correct(p_q);
  if v_fixed is not null then
    execute format('select count(*) from (select 1 from inspo_products p where %s limit 1) s',
                   search_match_sql(array(select stem from search_words(v_fixed))) || search_filter_sql())
      into v_count
      using p_product_type, p_brand, p_merchant, p_price_min, p_price_max, p_gender, p_hide_season, coalesce(p_on_sale, false);
    if v_count > 0 then
      return jsonb_build_object('mode', 'corrected', 'q', v_fixed, 'dropped', '[]'::jsonb);
    end if;
  end if;

  -- 2. Relax what the visitor TYPED: a correction that found nothing is a
  --    guess that failed ("moduline sofa" -> "modulis sof"), and showing it
  --    back would only confuse. At most six words (63 subsets; each count is
  --    an index probe of ~10 ms).
  select array_agg(word), array_agg(stem)
    into v_words, v_stems
    from (select * from search_words(p_q) limit 6) w;

  if v_words is null then
    return jsonb_build_object('mode', 'popular', 'q', null, 'dropped', '[]'::jsonb);
  end if;

  -- A word nothing matches can't be part of any answer: drop it up front.
  for i in 1 .. cardinality(v_words) loop
    execute format('select count(*) from (select 1 from inspo_products p where %s limit 1) s',
                   search_match_sql(array[v_stems[i]]) || search_filter_sql())
      into v_count
      using p_product_type, p_brand, p_merchant, p_price_min, p_price_max, p_gender, p_hide_season, coalesce(p_on_sale, false);
    if v_count > 0 then
      v_use_w := v_use_w || v_words[i];
      v_use_s := v_use_s || v_stems[i];
    end if;
  end loop;

  v_n := cardinality(v_use_w);
  if v_n = 0 then
    return jsonb_build_object('mode', 'popular', 'q', null, 'dropped', to_jsonb(v_words));
  end if;

  -- Largest subset first; among equal sizes, the one with the most results.
  for v_size in reverse v_n .. 1 loop
    v_best := 0;
    for v_mask in 1 .. (1 << v_n) - 1 loop
      continue when length(replace(v_mask::bit(6)::text, '0', '')) <> v_size;
      v_sel := array(select v_use_s[j] from generate_series(1, v_n) j where (v_mask >> (j - 1)) & 1 = 1);
      execute format('select count(*) from (select 1 from inspo_products p where %s limit 200) s',
                     search_match_sql(v_sel) || search_filter_sql())
        into v_count
        using p_product_type, p_brand, p_merchant, p_price_min, p_price_max, p_gender, p_hide_season, coalesce(p_on_sale, false);
      if v_count > v_best then
        v_best := v_count;
        v_bmask := v_mask;
      end if;
    end loop;

    if v_best > 0 then
      v_sel := array(select v_use_w[j] from generate_series(1, v_n) j where (v_bmask >> (j - 1)) & 1 = 1);
      return jsonb_build_object(
        'mode', 'relaxed',
        'q', array_to_string(v_sel, ' '),
        'dropped', to_jsonb(array(select w from unnest(v_words) w where not (w = any (v_sel)))));
    end if;
  end loop;

  -- Unreachable in practice: every kept word matched on its own.
  return jsonb_build_object('mode', 'popular', 'q', null, 'dropped', to_jsonb(v_words));
end
$function$;

comment on function public.search_fallback is
  'For a search with no results: {mode: corrected|relaxed|popular, q, dropped}. Spelling fix first, then the largest subset of words that still matches, else popular. Same filters as search_products. See 20261112120000.';

grant execute on function public.search_fallback(text, text, text, text, numeric, numeric, text, text, boolean) to anon, authenticated;
