-- Word-matching alone leaked: "Seksuali suknelė", "Seksualūs vyriški stringai"
-- and "Penio pompa" all survived the first pass, because the pattern carried
-- `sekso ` (with a trailing space) rather than `seksual`, and had no term for
-- pumps. 638 rows were still visible.
--
-- The real fix is that Pigu publishes its OWN age gate as a category:
-- "prekes suaugusiems   n18lt", "n18 lt prekes suaugusiems",
-- "kosmetika suaugusiems", "penio vaginos pompos". Trusting the merchant's N18
-- label catches the entire aisle regardless of how innocuous a title reads
-- ("Kombinezonas Noir Lace", "Marškinėliai Svenjoyment"), which no word list
-- ever will. The word patterns stay as the backstop for merchants that publish
-- no such category.
create or replace function public.is_age_restricted(p_category text, p_name text, p_brand text)
returns boolean language sql immutable as $$
  with h as (
    select coalesce(p_category,'') || ' ' || coalesce(p_name,'') || ' ' || coalesce(p_brand,'') as t
  )
  select
    coalesce(p_category,'') ~* '(suaugusiems|\mn18|penio vaginos)'
    or (select t from h) ~* (
       '(ginkl|karabin|šovini|sovini|amunicij|airsoft|straikbol|arbalet|'
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
    or ((select t from h) ~* '(šautuv|sautuv|pistolet|revolver|pneumatin)'
        and (select t from h) !~* '(masaž|masaz|klij|dažym|dazym|karšto oro|karsto oro|silikon|suvirin|purkšt|purkst|terminis)');
$$;

-- Period products and intimate hygiene are not age-restricted, but they are not
-- gifts either — they belong here rather than in the age gate.
create or replace function public.is_giftable(p_category text, p_name text)
returns boolean language sql immutable as $$
  select not (coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* (
       '(padang|automobilin[ei] kilim|auto prek|autoprek|autoreikmen|tepal|variklio alyv|akumuliator|'
    || 'baldai|baldas|spinta|komod|sofa|fotelis|lova|čiužin|ciuzin|lentyn|'
    || 'kilimai|kilimėl|kilimel|patalyn|antklod|pagalv[ėe]|užuolaid|uzuolaid|rolet|karniz|'
    || 'santechnik|remont|apdail|statyb|radiator|vamzd|maišytuv|maisytuv|'
    || 'buitine chemij|valymo priemon|skalbimo milt|'
    || 'liemenėl|liemenel|kelnaitė|kelnaite|apatin|trumpik|bikini|maudym|tanga|glaustinuk|string|'
    || 'sauskeln|servetėl|servetel|tampon|įklot|iklot|intymios higienos|'
    || 'atsargin[ėe] dal|filtras)'))
    and not public.is_age_restricted(p_category, p_name, null);
$$;

delete from public.inspo_products
where public.is_age_restricted(category_name, product_name, brand_name);
