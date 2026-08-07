-- Age-restricted goods must never reach the inspo catalogue: weapons, adult
-- products, alcohol, tobacco/nicotine, gambling, pyrotechnics.
--
-- Enforced at INSERT rather than filtered at read time. A read-time filter is
-- one forgotten `where` clause away from surfacing a rifle in a gift shelf;
-- returning NULL from a BEFORE INSERT row trigger means the row never lands,
-- whichever importer or backfill wrote it. Scoped to INSERT — on UPDATE a NULL
-- would silently abandon the write instead.
--
-- Patterns are narrow where a broad one would eat real gifts. Each exception
-- below is a product the first draft would have deleted:
--   \mkonjakas\M  "ruda (konjako)" is a COLOUR (cognac brown) across About
--                 You's fashion — Birkenstock slippers, Tom Tailor belts, bags.
--   \mvape\M      "VAPORISATEUR" (Chanel) and Nike "Zoom Vapor" boots.
--   \manalin      matched inside "kANALINis ventiliatorius".
--   firearms      massage guns, glue guns and paint sprayers are legitimate
--                 gifts, so those terms carry a tool/therapy exception.
-- Plain "peilis" is deliberately absent so kitchen knife sets survive.
create or replace function public.is_age_restricted(p_category text, p_name text, p_brand text)
returns boolean language sql immutable as $$
  with h as (
    select coalesce(p_category,'') || ' ' || coalesce(p_name,'') || ' ' || coalesce(p_brand,'') as t
  )
  select
    (select t from h) ~* (
       '(ginkl|karabin|šovini|sovini|amunicij|airsoft|straikbol|arbalet|'
    || 'kastet|durkl|mačet|machet|teleskopin[ėe] lazd|elektrošok|elektrosok|'
    || 'dujų balionėl|duju balionel|savigynos priemon|kovinis peilis|medžioklinis peilis|'
    || 'pirotechnik|fejerverk|petard|sprogm|'
    || 'sekso |sex toy|vibrator|dildo|erotin|erotik|prezervatyv|lubrikant|'
    || 'masturbat|\manalin|anal plug|butt plug|bdsm|striptiz|intymi[ųu] preki|'
    || 'falo imitator|varpos imitator|penio narv|varpos kaišt|'
    || 'alkoholi|degtin|viskis|whisky|\mkonjakas\M|brendis|likeris|tekila|'
    || '\mvynas\M|vyno butel|\malus\M|šampanas|sampanas|'
    || 'tabak|cigaret|\mcigarai\M|nikotin|\mvape\M|vaping|elektronin[ėe] cigaret|kaljan|kalian|snus|'
    || 'kazino|lošimo|losimo|loterij)')
    or ((select t from h) ~* '(šautuv|sautuv|pistolet|revolver|pneumatin)'
        and (select t from h) !~* '(masaž|masaz|klij|dažym|dazym|karšto oro|karsto oro|silikon|suvirin|purkšt|purkst|terminis)');
$$;

-- Belt and braces: anything predating the trigger is also not giftable, so
-- discover and the shelves exclude it even if a row slips in another way.
create or replace function public.is_giftable(p_category text, p_name text)
returns boolean language sql immutable as $$
  select not (coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* (
       '(padang|automobilin[ei] kilim|auto prek|autoprek|autoreikmen|tepal|variklio alyv|akumuliator|'
    || 'baldai|baldas|spinta|komod|sofa|fotelis|lova|čiužin|ciuzin|lentyn|'
    || 'kilimai|kilimėl|kilimel|patalyn|antklod|pagalv[ėe]|užuolaid|uzuolaid|rolet|karniz|'
    || 'santechnik|remont|apdail|statyb|radiator|vamzd|maišytuv|maisytuv|'
    || 'buitine chemij|valymo priemon|skalbimo milt|'
    || 'liemenėl|liemenel|kelnaitė|kelnaite|apatin|trumpik|bikini|maudym|tanga|glaustinuk|'
    || 'sauskeln|servetėl|servetel|atsargin[ėe] dal|filtras)'))
    and not public.is_age_restricted(p_category, p_name, null);
$$;

create or replace function public.inspo_products_derive()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.skip_derive', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT'
     and public.is_age_restricted(new.category_name, new.product_name, new.brand_name) then
    return null;
  end if;

  new.product_type := public.classify_product_type(new.category_name, new.product_name);
  new.giftable     := public.is_giftable(new.category_name, new.product_name);
  new.gift_score   := public.compute_gift_score(
    new.brand_name, new.product_type, new.price, new.discount_pct,
    new.product_name, new.gender, new.rrp);
  return new;
end;
$$;

-- One-off removal of what was already in the table when this landed (1,510 rows).
delete from public.inspo_products
where public.is_age_restricted(category_name, product_name, brand_name);
