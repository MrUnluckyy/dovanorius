-- Task 3: merchant_domain helper.
-- Normalises a product URL down to a bare, lowercased host:
--   https://www.Douglas.lt:443/p/foo?x=1#frag  ->  douglas.lt
-- Handles null/empty input (returns null), scheme, userinfo, path, query,
-- fragment, port and a leading "www.".
create or replace function public.extract_domain(url text)
returns text
language sql
immutable
as $function$
  select nullif(
    regexp_replace(                                   -- 5. strip leading www.
      regexp_replace(                                 -- 4. strip :port
        regexp_replace(                               -- 3. cut at path/query/fragment
          regexp_replace(                             -- 2. strip user:pass@
            regexp_replace(                           -- 1. strip scheme://
              lower(btrim(coalesce(url, ''))),
              '^[a-z][a-z0-9+.-]*://', ''
            ),
            '^[^/@]*@', ''
          ),
          '[/?#].*$', ''
        ),
        ':[0-9]+$', ''
      ),
      '^www\.', ''
    ),
    ''
  );
$function$;

comment on function public.extract_domain(text) is
  'Normalises a URL to a bare lowercased host (no scheme/www/path/port). Used by the purchase_events trigger and the merchant analytics views.';
