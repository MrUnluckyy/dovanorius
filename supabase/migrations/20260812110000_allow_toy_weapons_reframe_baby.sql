-- Toy weapons are toys.
--
-- Water pistols, foam blasters and cap guns are ordinary children's gifts in LT
-- and were being deleted alongside actual firearms — "Vandens šautuvas" and
-- "Žaislinis šautuvas su kulkomis" both went.
--
-- `ginkl` moves out of the unambiguous list and joins the firearm group that
-- already carries an exception clause, so a toy version passes while a real one
-- does not. The exception now covers toy/water/foam wording alongside the
-- existing tool and massage terms.
--
-- Still blocked: pneumatic and airsoft guns, ammunition, and anything from a
-- weapons retailer.
create or replace function public.is_age_restricted(p_category text, p_name text, p_brand text)
returns boolean language sql immutable as $$
  with h as (
    select coalesce(p_category,'') || ' ' || coalesce(p_name,'') || ' ' || coalesce(p_brand,'') as t
  )
  select
    coalesce(p_category,'') ~* '(suaugusiems|\mn18|penio vaginos)'
    or (select t from h) ~* (
       '(karabin|šovini|sovini|amunicij|straikbol|arbalet|'
    || 'kastet|durkl|mačet|machet|teleskopin[ėe] lazd|elektrošok|elektrosok|'
    || 'dujų balionėl|duju balionel|savigynos priemon|kovinis peilis|medžioklinis peilis|'
    || 'pirotechnik|fejerverk|petard|sprogm|'
    || 'seksual|sekso |sex toy|vibrator|dildo|erotin|erotik|prezervatyv|lubrikant|'
    || 'masturbat|\manalin|anal plug|butt plug|bdsm|striptiz|intymi[ųu] preki|feromon|'
    || 'falo imitator|penio|\mpenis\M|varpos (imitator|kaišt|pompa|antgal|žied|narv)|'
    || 'vagin|makšt|vulv|klitor|orgazm|afrodiziak|'
    || 'alkoholi|degtin|viskis|whisky|\mkonjakas\M|brendis|likeris|tekila|'
    || '\mvynas\M|vyno butel|\malus\M|šampanas|sampanas|'
    || 'tabak|cigaret|\mcigarai\M|nikotin|\mvape\M|vaping|elektronin[ėe] cigaret|kaljan|kalian|snus|'
    || 'kazino|lošimo|losimo|loterij)')
    or ((select t from h) ~* '(ginkl|šautuv|sautuv|pistolet|revolver|pneumatin|airsoft)'
        and (select t from h) !~* (
             '(žaisl|zaisl|vanden|muilo burbul|nerf|putų|putu|'
          || 'masaž|masaz|klij|dažym|dazym|karšto oro|karsto oro|silikon|suvirin|purkšt|purkst|terminis)'));
$$;

-- Kūdikiui was the thinnest shelf and narrowly framed: most baby gifts are
-- really bought for the parents. Widening the recipient opens home and kitchen
-- honestly rather than by loosening the quality bar.
update public.gift_personas set
  label_lt = 'Kūdikiui ir naujiems tėvams',
  label_en = 'For a baby and new parents',
  description = 'A baby or toddler under three, and the parents who are looking after them. Soft, safe, practical things for the child — nothing with small parts, nothing electronic — and things that make the first months easier or kinder for the adults: a good blanket, a keepsake, something warm for surviving 3am. NOT nappies, NOT wipes, NOT anything disposable.',
  product_types = '{toys,home,kitchen}',
  include_keywords = '{pliušin,kūdikiams,vystyklas,antklodė,barškutis,medinis žaislas,maudynių,pledas,puodelis,arbatos,žvakė,nuotraukų rėmelis}',
  exclude_keywords = '{sauskelnės,servetėlės,konsolė,ausinės}',
  price_min = 10, price_max = 120,
  examples = '{"a soft plush toy","a wooden stacking toy","a keepsake photo frame for the first year","a very good blanket for the nursery","a bath toy set","a thermal mug that survives being forgotten twice","a first picture book"}'
where slug = 'baby';
