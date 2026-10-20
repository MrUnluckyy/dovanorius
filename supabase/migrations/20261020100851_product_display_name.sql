-- Clean product names for display (T6 of dev-issue-discover-premium, 5.1).
--
-- Feed names carry merchant noise: SKU codes ("Fossil Laikrodis Raquel
-- ES5305 Auksinė"), the brand repeated in front of the name the card already
-- shows under the brand line, fit labels ("Regular Fit"), gender and pack
-- tokens ("125 ml male", "1 pieces female") and long colour lists.
--
-- display_name is a PostgREST computed column (select=*,display_name), not a
-- stored one: no rewrite of the ~900 MB table, no backfill, and a rule change
-- here applies everywhere at once. A page cleans 24-48 names; the cost is
-- nothing. product_name stays untouched for search.
--
-- Additive only.

create or replace function public.clean_product_name(
  p_name text,
  p_brand text,
  p_merchant text
)
returns text
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  n text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  brand_re text;
  -- Fashion catalogues, where codes in the name are pure noise. Pigu and the
  -- small shops keep theirs: a tech model number ("HB-202NG") is information.
  fashion boolean := p_merchant in ('Modivo LT', 'Eavalyne LT', 'About You LT', '4F LT');
  tokens text[];
  kept text[] := '{}';
  tok text;
  nxt text;
  i int;
begin
  if n = '' then
    return p_name;
  end if;

  -- 1. The brand, wherever it is: in front with a separator ("Rituals - ..."),
  --    in front without one ("Fossil Laikrodis ..."), or after the type
  --    ("Rankinė Lasocki ..."). The card shows it on its own line.
  if coalesce(btrim(p_brand), '') <> '' then
    brand_re := regexp_replace(btrim(p_brand), '([.*+?^${}()|\[\]\\])', '\\\1', 'g');
    n := regexp_replace(n, '^' || brand_re || '\s*[-–:|]\s*', '', 'i');
    n := regexp_replace(n, '(^|\s)' || brand_re || '(?=\s|$)', '\1', 'gi');
    n := btrim(regexp_replace(n, '\s+', ' ', 'g'));
  end if;

  -- 2. Merchant suffixes: fit labels, gender and pack tokens.
  -- Modivo has more fit names than anyone would list ("Modern Fit", "Baggy
  -- Fit", "Bootcut Fit"): any one word + "Fit" at the end, and "Oversize".
  if fashion then
    n := regexp_replace(n, '\s+\S+\s+Fit$', '');
    n := regexp_replace(n, '\s+Oversized?$', '');
  end if;
  n := regexp_replace(n, '(\s+(female|male|unisex|uniseks|uniwersalny|universalus|universali|\d+\s*pieces?))+$', '', 'i');

  -- 3. About You lists every colour ("rožių spalva / burgundiško vyno spalva /
  --    balta"): keep the first.
  if position(' / ' in n) > 0 then
    n := split_part(n, ' / ', 1);
  end if;

  -- 4. Repeated volumes ("750 ml, 750 ml").
  n := regexp_replace(n, '(\d+(?:[.,]\d+)?\s?(?:ml|l|g|kg))(?:,\s*\1)+', '\1', 'gi');

  -- 5. Fashion only: SKU tokens and stray size letters. A code is a token of
  --    capitals, digits and punctuation: with letters, at least three digits
  --    ("ES5305", "KW0KW02329"); digits only, at least five ("2108261"), so
  --    feature numbers like "5000 membrana" stay. Never a quantity followed
  --    by its unit ("100 ml", "190 X 140").
  if fashion then
    tokens := regexp_split_to_array(n, '\s+');
    for i in 1 .. coalesce(array_length(tokens, 1), 0) loop
      tok := tokens[i];
      nxt := tokens[i + 1];
      if tok ~ '^[A-Z0-9][A-Z0-9./()\-_]*$'
         and length(tok) >= 4
         and (
           (tok ~ '[A-Z]' and length(regexp_replace(tok, '[^0-9]', '', 'g')) >= 3)
           or (tok !~ '[A-Z]' and length(regexp_replace(tok, '[^0-9]', '', 'g')) >= 5)
         )
         -- only a bare number can be a quantity; a code with letters never is
         and not (tok !~ '[A-Z]' and nxt is not null
                  and nxt ~* '^(ml|l|g|kg|mg|cm|mm|m|vnt\.?|w|v|mah|gb|tb|x|dalių|det\.?|psl\.?)$') then
        continue;
      end if;
      -- shop-internal codes with a letter prefix ("CEO-WI16-GIRO-08",
      -- "EO-DEXTER-12"): too few digits for the rule above, unmistakable anyway
      if tok ~ '^(CEO|EO|C|WBEO|CWBEO|CEOWB|EOSB)-[A-Z0-9][A-Z0-9./()\-_]*$' then
        continue;
      end if;
      -- a lone size letter left behind ("C8011 M Rožinė"), never the first word
      if i > 1 and tok ~ '^(XXS|XS|S|M|L|XL|XXL|XXXL)$' then
        continue;
      end if;
      kept := kept || tok;
    end loop;
    n := array_to_string(kept, ' ');
    -- 4F puts the size last: "… - tamsiai mėlynos XXL", "… - smėlio one size".
    n := regexp_replace(n, '\s+(one size|vienas dydis)$', '', 'i');
    -- …and children's heights, shoe sizes and 3XL after the colour
    -- ("- juoda 158", "- balti 40", "- juoda 3XL").
    if p_merchant = '4F LT' then
      n := regexp_replace(n, '(\s[-–]\s.*\S)\s+(\d{2,3}|\d?X{1,3}L|XS|S|M|L)$', '\1');
    end if;
  end if;

  -- 6. Tidy up: spaces, dangling separators, first letter.
  n := btrim(regexp_replace(n, '\s+', ' ', 'g'));
  n := btrim(regexp_replace(n, '^[\s,;:–-]+|[\s,;:–-]+$', '', 'g'));
  if n !~ '[[:alpha:]]' or length(n) < 3 then
    return p_name; -- never worse than the original
  end if;
  return upper(left(n, 1)) || substr(n, 2);
end;
$$;

-- PostgREST computed column: GET /inspo_products?select=*,display_name and
-- search_products(...)?select=*,display_name both work.
create or replace function public.display_name(p public.inspo_products)
returns text
language sql
stable
parallel safe
set search_path = public
as $$
  select public.clean_product_name(p.product_name, p.brand_name, p.merchant_name)
$$;

grant execute on function public.clean_product_name(text, text, text) to anon, authenticated;
grant execute on function public.display_name(public.inspo_products) to anon, authenticated;
