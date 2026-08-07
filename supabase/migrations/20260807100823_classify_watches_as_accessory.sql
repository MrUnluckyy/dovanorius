-- A "Laikrodis Ice-Watch" is a jewellery-shelf gift, not a gadget: `laikrod` in
-- the tech bucket made the whole tech shelf watches. Moves to accessory; tech
-- keeps the explicit smart variants.
create or replace function public.classify_product_type(p_category text, p_name text)
returns text language sql immutable as $$
  select case
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(kvepal|parfum|perfume|lūp[ųu] daž|makiaž|kremas|kremai|veido|plauk[ųu]|kosmetik|beauty|fragrance|grozis|grožis)' then 'beauty'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(žaisl|zaisl|lego|konstruktor|lėl[ėe]|lel[ei]|stalo žaidim|stalo zaidim|dėlion|delion|pliušin|pliusin|puzzle)' then 'toys'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(ausin[ėe]|kolon[ėe]l|išmanus|ismanus|išmanieji|planšet|planset|telefon|kompiuter|nešiojam|nesiojam|monitor|klaviatūr|klaviatur|konsol|playstation|xbox|fotoaparat|kamer|dron|smartwatch|išmanus laikrod)' then 'tech'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(virtuv[ėe]s ir stalo|puod(as|ai|ų|u)|keptuv|kavos aparat|kavamal|arbatin|taur[ėe]s|indų|stalo įrank|stalo irank|prieskoni|trintuv|virdul)' then 'kitchen'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(įrank|irank|gręžtuv|greztuv|atsuktuv|plaktuk|pjūkl|pjukl|suktuv|dirbtuv|proxxon|makita)' then 'tools'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(sporto prek|sprto prek|dvirat|riedut|riedlent|turizm|žygio|zygio|palapin|miegmaiš|miegmais|treniruokl|joga|fitnes|žvejyb|zvejyb|slidin)' then 'sport'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(gyvūn|gyvun|šuni|suni|katė|naguči|pašar|pasar)' then 'pets'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(sodo prek|sodinin|gėli[ųu]|geli[uu]|vazon|grilis|kepsnin)' then 'garden'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(žvak|zvak|vaz[ao]|namų interjer|namu interjer|pled|paveiksl|dekor|šviestuv|sviestuv)' then 'home'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(bat[aųiø]|batel|sneaker|krosov|aulini|sandal|šlepet|slepet|loafer|mokasin|shoe|boot|kedai|espadril|basut)' then 'shoes'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(rankin|kuprin|krepšy|krepsy|pinigin|backpack|wallet|handbag|lagamin)' then 'bag'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(suknel|kelnės|kelnes|džins|dzins|striuk|palaidin|marškin|marskin|megztin|sijon|liemenėl|\mpaltas\M|švark|svark|kostium|džemper|dzemper|dress|shirt|jean|jacket|coat|sweater|trouser|\mskirts?\M|kardigan|sportbač)' then 'clothing'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(laikrod|kepur|šalik|salik|pirštin|pirstin|dirž|dirz|kaklaraišt|akini|papuoš|papuos|apyrank|grandin[ėe]l|auskar|žied(as|ai|ą))' then 'accessory'
    else 'other'
  end;
$$;
