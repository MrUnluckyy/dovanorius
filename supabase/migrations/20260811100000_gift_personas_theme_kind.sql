-- Themed shelves become curated rows too, not live keyword queries.
--
-- The keyword shelves failed the same way three times: substring matching on
-- product titles cannot tell what a thing IS.
--   `kompiuter` put laptop BAGS in the tech shelf (790 of 7,184 rows)
--   `lego`      filled the toys shelf with LEGO t-shirts, beanies and mittens
--   `suni`      put NAPAPIJRI "M-Ya-SUNI" trousers in the pet shelf
--   `lel`       pulled Aldo "Ca-LELI-an" sandals into toys
--   `katė`      put cat-eye sunglasses in the pet shelf
-- The curated pipeline, given the same catalogue, produced a real shelf.
--
-- So a shelf is just a persona with kind='theme': same curation job, same
-- examples-as-calibration, rendered inline rather than on selection.
alter table public.gift_personas
  add column if not exists kind text not null default 'recipient'
  check (kind in ('recipient', 'theme'));

comment on column public.gift_personas.kind is
  'recipient = chosen by the shopper from the picker; theme = an editorial shelf rendered inline. Same curation pipeline for both.';

comment on column public.gift_personas.examples is
  'Few-shot exemplars handed to the curator — this is where a shelf''s taste is defined. Edit freely; the weekly refresh picks up changes. No deploy needed.';

insert into public.gift_personas
  (slug, kind, label_lt, label_en, description, gender, age_min, age_max,
   product_types, include_keywords, exclude_keywords, price_min, price_max, examples, sort_order)
values
 ('cosy-home', 'theme', 'Namų jaukumui', 'For a cosy home',
  'Gifts that make a home feel warm and personal — the kind of object someone would not buy for themselves but is delighted to receive. Candles, ceramics, textiles, warm lighting, things for a slow evening at home. NOT furniture, NOT appliances, NOT storage or cleaning.',
  null, null, null,
  '{home,kitchen}',
  '{žvakė,pledas,vaza,keramik,aromat,difuzor,taurės,puodelis,arbatos,kavos,žibintas,nuotraukų rėmelis,padėkliukai}',
  '{valymo,šluostė,šiukšlia,laikymo dėžė,vonios kilim,įrankių}',
  15, 120,
  '{"a hand-poured scented candle in a glass jar",
    "a chunky knitted wool throw for the sofa",
    "a stoneware mug with a matte glaze",
    "a reed diffuser with a warm amber scent",
    "a pair of hand-blown wine glasses",
    "a small brass photo frame",
    "a cast-iron tea pot",
    "a linen table runner"}',
  15)
on conflict (slug) do update
  set kind = excluded.kind,
      description = excluded.description,
      product_types = excluded.product_types,
      include_keywords = excluded.include_keywords,
      exclude_keywords = excluded.exclude_keywords,
      examples = excluded.examples;
