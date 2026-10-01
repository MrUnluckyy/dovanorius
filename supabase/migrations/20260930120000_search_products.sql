-- Product search that both clients (web + noriuto-app) call.
--
-- Before this, each client ran `product_name ILIKE '%term%'` ordered by
-- gift_score, which had three problems:
--   * no folding: "begimo takelis" found 0, "bėgimo takelis" found 9;
--   * one literal phrase: "takeliai" or reordered words found nothing;
--   * no relevance: "lego" led with LEGO Wear hats, a balaclava and video
--     games, because they share gift_score 75 with 270 actual LEGO sets.
--
-- Matching runs on search_norm (lowercased, unaccented "name brand category",
-- trigram-indexed; see 20260908100000). The TERM is folded here, never the
-- column: unaccent() on the column cannot use the index (a >6 min query).
--
-- Each word is its own LIKE (AND), with a crude Lithuanian ending strip so
-- "takelis"/"takeliai" and "žaislai"/"žaislų" meet at the same stem.
--
-- Ranking is two-tier because relevance needs every match read from disk, and
-- "marškinėliai" has ~30k (measured 20s):
--   * <= 600 matches: rank all of them. Name coverage, word-start hits, brand
--     hit, and the share of matches in each product_type ("intent": 86% of
--     "lego" matches are toys, so toys lead), with gift_score as tie-breaker.
--   * more: plain gift_score order, which the planner serves by walking
--     inspo_products_giftscore_idx (1.3s cold for "batai"). Broad words are
--     dominated by one type anyway, so intent would add little.
-- An explicit sort (price, discount) always uses plain ordering.

create or replace function public.search_products(
  p_q            text,
  p_product_type text    default null,
  p_brand        text    default null,
  p_merchant     text    default null,
  p_price_min    numeric default null,
  p_price_max    numeric default null,
  p_gender       text    default null,  -- 'male' | 'female': hide the opposite, keep unisex/unknown
  p_hide_season  text    default null,  -- 'summer' | 'winter': hide that season, keep 'all'/unknown
  p_on_sale      boolean default false,
  p_sort         text    default 'relevance', -- price_asc | price_desc | discount; anything else = relevance
  p_limit        integer default 24,
  p_offset       integer default 0
)
returns setof public.inspo_products
language plpgsql
stable
set search_path = public
as $function$
declare
  v_tokens  text[];
  v_where   text;
  v_matches integer;
  v_limit   integer := least(greatest(coalesce(p_limit, 24), 1), 100);
  v_offset  integer := greatest(coalesce(p_offset, 0), 0);
  v_order   text;
begin
  -- Fold, split on anything that isn't a letter or digit, drop words under 3
  -- characters (Lithuanian "su", "ir", and too short for the trigram index),
  -- then strip one inflectional ending from long words when the stem keeps 4+.
  select array_agg(distinct t)
    into v_tokens
    from (
      select case
               when length(w) > 5
                and length(regexp_replace(w, '(iams|iems|ams|oms|ems|ims|iai|ius|uos|ais|iu|as|is|ys|us|os|es|ai|ei|a|e|i|o|u)$', '')) >= 4
               then regexp_replace(w, '(iams|iems|ams|oms|ems|ims|iai|ius|uos|ais|iu|as|is|ys|us|os|es|ai|ei|a|e|i|o|u)$', '')
               else w
             end as t
        from regexp_split_to_table(
               regexp_replace(lower(nr_unaccent(coalesce(p_q, ''))), '[^a-z0-9]+', ' ', 'g'),
               ' '
             ) as w
       where length(w) >= 3
    ) s;

  if v_tokens is null then
    return;
  end if;

  -- Tokens are [a-z0-9] only, and %L quotes them regardless.
  select string_agg(format('p.search_norm like %L', '%' || t || '%'), ' and ')
    into v_where
    from unnest(v_tokens) t;

  v_where := v_where || '
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
    and (not $8 or (p.discount_pct > 0 and p.discount_pct <= 85))';

  v_order := case p_sort
    when 'price_asc'  then 'p.price asc, p.id'
    when 'price_desc' then 'p.price desc, p.id'
    when 'discount'   then 'p.discount_pct desc, p.id'
    else 'p.gift_score desc, p.sort_key, p.id'
  end;

  -- Anything but an explicit sort is relevance (the web sends 'recommended').
  if coalesce(p_sort, 'relevance') not in ('price_asc', 'price_desc', 'discount') then
    execute format('select count(*) from (select 1 from inspo_products p where %s limit 601) s', v_where)
      into v_matches
      using p_product_type, p_brand, p_merchant, p_price_min, p_price_max, p_gender, p_hide_season, coalesce(p_on_sale, false);

    if v_matches <= 600 then
      return query execute format($q$
        with m as (
          select p.id, p.product_type, p.gift_score, p.sort_key,
                 lower(nr_unaccent(p.product_name)) as fn,
                 lower(nr_unaccent(coalesce(p.brand_name, ''))) as fb
            from inspo_products p
           where %s
        ),
        intent as (
          select product_type, count(*)::float / sum(count(*)) over () as share
            from m group by product_type
        ),
        scored as (
          select m.*,
                 1.0 * (select count(*) from unnest($9) t where m.fn like '%%' || t || '%%')::float / cardinality($9)
               + 0.5 * (select count(*) from unnest($9) t where m.fn ~ ('\m' || t))::float / cardinality($9)
               + 0.3 * (exists (select 1 from unnest($9) t where m.fb like '%%' || t || '%%'))::int
               + 1.5 * coalesce(i.share, 0)
               + 0.5 * coalesce(m.gift_score, 0) / 100.0 as rank
            from m left join intent i using (product_type)
        )
        -- Rank on the narrow CTE, then fetch whole rows for this page only, so
        -- new inspo_products columns never have to be listed here.
        select p.*
          from (select id, rank, sort_key from scored
                 order by rank desc, sort_key, id
                 limit %s offset %s) r
          join inspo_products p on p.id = r.id
         order by r.rank desc, r.sort_key, r.id
      $q$, v_where, v_limit, v_offset)
      using p_product_type, p_brand, p_merchant, p_price_min, p_price_max, p_gender, p_hide_season, coalesce(p_on_sale, false), v_tokens;
      return;
    end if;
  end if;

  return query execute format(
    'select p.* from inspo_products p where %s order by %s limit %s offset %s',
    v_where, v_order, v_limit, v_offset)
    using p_product_type, p_brand, p_merchant, p_price_min, p_price_max, p_gender, p_hide_season, coalesce(p_on_sale, false);
end
$function$;

comment on function public.search_products is
  'Diacritic-insensitive, per-word product search with relevance ranking (<=600 matches) or gift_score order (broader). Shared by web and noriuto-app. See migration 20260930120000.';

grant execute on function public.search_products to anon, authenticated;
