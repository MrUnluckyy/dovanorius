-- Relevance metadata for the discover feed (Phase 2).
--
-- APPLIED to prod 2026-07-24 via Supabase MCP.
--
-- Stopgap: gender/season/product_type are derived by keyword rules from
-- product_name because the current AWIN importer drops those source fields
-- (it even mashed the gender token into product_name — hence the "… unisex"
-- suffixes). The rebuilt importer will populate these columns from AWIN's
-- Fashion:suitable_for / merchant_category / season fields, making the backfill
-- below obsolete. null gender = unknown = shown to everyone.

alter table public.inspo_products
  add column if not exists gender       text,
  add column if not exists season       text,
  add column if not exists product_type text;

create index if not exists inspo_products_gender_idx on public.inspo_products (gender);
create index if not exists inspo_products_season_idx on public.inspo_products (season);

alter table public.profiles
  add column if not exists discover_audience text
    check (discover_audience in ('her','him','everyone'));

-- One-time backfill (keyword classification).
update public.inspo_products set
  gender = case
      when product_name ~* '\yunisex\y' then 'unisex'
      when product_name ~* '\y(vyr|vyriš|vyrams)\y' or (product_name ~* '\ymale\y' and product_name !~* '\yfemale\y') then 'male'
      when product_name ~* '\y(female|moter|moteriš)\y'
        or product_name ~* '(suknel|liemenėl|braletė|sijon|palaidin|nėrini|lūp[ųu] daž|blakstien|makiaž|skaist|pudr[aos])'
        then 'female'
      else null
    end,
  season = case
      when product_name ~* '(sniego|žiem|auliniai|kailin|pašiltint|\ypaltas\y)' then 'winter'
      when product_name ~* '(sandal|šlepet|basut|maudym|\yvasar|bikin)' then 'summer'
      else 'all'
    end,
  product_type = case
      when merchant_name = 'Douglas LT' or product_name ~* '(kvepal|lūp|akių|veido|plaukų|krem|parfum|makiaž|\ytuš|pudr|dažai)' then 'beauty'
      when product_name ~* '(bat[aųiø]|sneaker|krosov|aulini|sandal|šlepet|loafer|mokasin)' then 'shoes'
      when product_name ~* '(rankinė|kuprinė|krepšy|piniginė)' then 'bag'
      when product_name ~* '(suknel|kelnės|džins|striuk|palaidin|marškin|megztin|sijon|liemenėl|\ypaltas\y|švark|kostium|džemper)' then 'clothing'
      when product_name ~* '(kepur|šalik|pirštin|diržas|kaklaraišt|akiniai|laikrod)' then 'accessory'
      else 'other'
    end;
