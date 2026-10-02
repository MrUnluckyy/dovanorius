-- Search analytics and typo correction, on top of search_products()
-- (20260930120000).
--
-- 1. search_log: one row per search (first page only), so we know what people
--    look for, and what they look for and don't find. The second list is the
--    one to take to partners: demand nobody in the catalogue serves yet. No
--    user id and no IP on purpose; only totals are ever read.
--
-- 2. search_vocab + search_correct(): when a search finds nothing, suggest a
--    spelling. Fuzzy-matching the query against search_norm itself was tried
--    and is useless: whole product strings dilute the trigram signal, so
--    "samsng" matched a shampoo and "begymo" took 3.9s. Matching one word
--    against a 31k-word vocabulary is 0-20ms and right: begymo→begimo,
--    samsng→samsung, adiddas→adidas, playstaton→playstation.

-- ---------------------------------------------------------------------------
-- Shared stemming, so search_products and search_correct can't drift apart.

create or replace function public.search_stem(w text)
returns text
language sql
immutable
set search_path = public
as $function$
  select case
           when length(w) > 5
            and length(regexp_replace(w, '(iams|iems|ams|oms|ems|ims|iai|ius|uos|ais|iu|as|is|ys|us|os|es|ai|ei|a|e|i|o|u)$', '')) >= 4
           then regexp_replace(w, '(iams|iems|ams|oms|ems|ims|iai|ius|uos|ais|iu|as|is|ys|us|os|es|ai|ei|a|e|i|o|u)$', '')
           else w
         end
$function$;

comment on function public.search_stem(text) is
  'Strips one Lithuanian inflectional ending from a folded word when the stem keeps 4+ chars (takelis/takeliai -> takel). Used by search_products and search_correct.';

-- ---------------------------------------------------------------------------
-- Vocabulary for spelling suggestions.

create table if not exists public.search_vocab (
  word text primary key,
  n    integer not null
);

create index if not exists search_vocab_word_trgm_idx
  on public.search_vocab using gin (word gin_trgm_ops);

-- Read only through search_correct (security definer).
alter table public.search_vocab enable row level security;

comment on table public.search_vocab is
  'Distinct words (3-30 chars, seen 3+ times) from in-stock giftable search_norm, with frequency. Rebuilt daily by refresh_search_vocab() via pg_cron.';

create or replace function public.refresh_search_vocab()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_rows integer;
begin
  -- delete + insert rather than truncate: truncate takes an exclusive lock and
  -- would stall suggestions for the length of the rebuild.
  delete from search_vocab;
  insert into search_vocab (word, n)
  select w, count(*)
    from inspo_products,
         regexp_split_to_table(regexp_replace(search_norm, '[^a-z0-9]+', ' ', 'g'), ' ') w
   where in_stock and giftable
     and length(w) between 3 and 30
     and w !~ '^[0-9]+$'
   group by w
  having count(*) >= 3;
  get diagnostics v_rows = row_count;
  return v_rows;
end
$function$;

revoke all on function public.refresh_search_vocab() from public, anon, authenticated;

-- Words that already occur (by stem prefix) are kept as typed; only unknown
-- words of 4+ letters are replaced. Returns null when nothing changed, so the
-- client shows a suggestion only when there is one.
create or replace function public.search_correct(p_q text)
returns text
language plpgsql
volatile -- set_config below; the function only reads
security definer
set search_path = public
as $function$
declare
  w       text;
  best    text;
  words   text[] := '{}';
  changed boolean := false;
begin
  perform set_config('pg_trgm.similarity_threshold', '0.35', true);

  for w in
    select x
      from regexp_split_to_table(
             regexp_replace(lower(nr_unaccent(coalesce(left(p_q, 100), ''))), '[^a-z0-9]+', ' ', 'g'),
             ' ') x
     where x <> ''
  loop
    if length(w) < 4
       or w ~ '^[0-9]+$'
       or exists (select 1 from search_vocab v where v.word like search_stem(w) || '%')
    then
      words := words || w;
    else
      select v.word into best
        from search_vocab v
       where v.word % w
       order by similarity(v.word, w) desc, v.n desc
       limit 1;
      if best is not null then
        words := words || best;
        changed := true;
      else
        words := words || w;
      end if;
    end if;
  end loop;

  return case when changed then array_to_string(words, ' ') end;
end
$function$;

grant execute on function public.search_correct(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Search log.

create table if not exists public.search_log (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  term       text not null,
  term_norm  text not null,
  results    integer not null,
  platform   text
);

create index if not exists search_log_created_idx on public.search_log (created_at);

-- Written only by log_search (security definer), read only by the service role.
alter table public.search_log enable row level security;

comment on table public.search_log is
  'One row per product search (first page only). results = matches, capped at 601. No user id or IP by design. Purged after 13 months.';

create or replace function public.log_search(p_term text, p_results integer, p_platform text)
returns void
language sql
security definer
set search_path = public
as $function$
  insert into search_log (term, term_norm, results, platform)
  values (
    left(p_term, 100),
    left(btrim(regexp_replace(lower(nr_unaccent(p_term)), '[^a-z0-9]+', ' ', 'g')), 100),
    greatest(p_results, 0),
    case when p_platform in ('web', 'app') then p_platform end
  );
$function$;

-- search_products runs as the caller, so the caller needs this.
grant execute on function public.log_search(text, integer, text) to anon, authenticated;

create or replace function public.search_stats(p_days integer default 30, p_limit integer default 100)
returns table (term text, searches bigint, zero_share numeric, avg_results numeric, last_at timestamptz)
language sql
stable
security definer
set search_path = public
as $function$
  select term_norm,
         count(*),
         round(avg((results = 0)::int), 2),
         round(avg(results), 1),
         max(created_at)
    from search_log
   where created_at > now() - make_interval(days => p_days)
     and term_norm <> ''
   group by term_norm
   order by count(*) desc, max(created_at) desc
   limit p_limit
$function$;

revoke all on function public.search_stats(integer, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- search_products: same behaviour, plus p_source and logging. Volatile now,
-- because it writes the log row. The signature changes, so drop and recreate
-- in this one transaction.

drop function if exists public.search_products(
  text, text, text, text, numeric, numeric, text, text, boolean, text, integer, integer);

create function public.search_products(
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
  p_offset       integer default 0,
  p_source       text    default null   -- 'web' | 'app', for search_log
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
  -- Fold, split on anything that isn't a letter or digit, drop words under 3
  -- characters (Lithuanian "su", "ir", and too short for the trigram index).
  select array_agg(distinct search_stem(w))
    into v_tokens
    from regexp_split_to_table(
           regexp_replace(lower(nr_unaccent(coalesce(left(p_q, 100), ''))), '[^a-z0-9]+', ' ', 'g'),
           ' ') as w
   where length(w) >= 3;

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
    end if;
  end if;

  if v_matches is null or v_matches > 600 then
    return query execute format(
      'select p.* from inspo_products p where %s order by %s limit %s offset %s',
      v_where, v_order, v_limit, v_offset)
      using p_product_type, p_brand, p_merchant, p_price_min, p_price_max, p_gender, p_hide_season, coalesce(p_on_sale, false);
  end if;
  get diagnostics v_rows = row_count;

  -- Log the search, not every page of it. With an explicit sort there was no
  -- count, so the first page's size stands in (0 still means "nothing found").
  if v_offset = 0 then
    perform log_search(p_q, coalesce(v_matches, v_rows), p_source);
  end if;
end
$function$;

comment on function public.search_products is
  'Diacritic-insensitive, per-word product search with relevance ranking (<=600 matches) or gift_score order (broader). Logs page-1 searches to search_log. Shared by web and noriuto-app. See 20260930120000 and 20261001090000.';

grant execute on function public.search_products to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schedules. The nightly feed import starts 03:17 UTC and can run ~3h, so the
-- vocabulary rebuilds after it.

select cron.schedule('refresh-search-vocab-daily', '30 7 * * *', 'select public.refresh_search_vocab();');
select cron.schedule('purge-search-log-daily', '50 3 * * *',
  $$delete from public.search_log where created_at < now() - interval '13 months'$$);

select public.refresh_search_vocab();
