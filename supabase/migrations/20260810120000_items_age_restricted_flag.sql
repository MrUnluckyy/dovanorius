-- Age awareness for user-pasted board items — FLAG, never block.
--
-- The catalogue rule (is_age_restricted) is tuned for merchant feeds and is far
-- too aggressive for the open web. Tested against all 591 live board items it
-- would have hit 8, of which only ONE was genuine:
--   * "vilnos-slepetes-SUAUGUSIEMS" — wool slippers in ADULT SIZES, not adult
--     content. "suaugusiems" only means N18 inside Pigu's category tree.
--   * "dziovintas-jaucio-penis" — a dried bull pizzle DOG CHEW.
--   * "Vandens šautuvas" — a water pistol.
--   * "Airsoft Arena" — an activity, not a weapon.
--
-- Rejecting someone's wool slippers is a worse failure than an airsoft gun
-- sitting on a private wishlist, so this rule covers only the unambiguous and
-- the outcome is a flag rather than a rejection. Deliberately absent:
-- `suaugusiems`, bare `penis`, bare `šautuv`, `airsoft`.
create or replace function public.is_age_restricted_user_content(p_url text, p_title text)
returns boolean language sql immutable as $$
  select (coalesce(p_url,'') || ' ' || coalesce(p_title,'')) ~* (
       '(vibrator|dildo|masturbat|sekso prek|sexshop|sex shop|erotik|erotin|'
    || 'prezervatyv|lubrikant|bdsm|striptiz|falo imitator|varpos imitator|penio narv|'
    || 'ginklai|ginklu parduotuv|šovini|sovini|amunicij|kastet|durkl|'
    || 'tabak|cigaret|elektronin[ėe] cigaret|\mvape\M|snus|kaljan|'
    || 'alkoholi|degtin|viskis|whisky|\mkonjakas\M|kazino|loterij)');
$$;

alter table public.items add column if not exists age_restricted boolean not null default false;

comment on column public.items.age_restricted is
  'Set by trigger from is_age_restricted_user_content(url, title). The owner keeps the item; it is hidden from public/shared surfaces. Never blocks a write.';

create or replace function public.items_flag_age_restricted()
returns trigger language plpgsql as $$
begin
  new.age_restricted := public.is_age_restricted_user_content(new.url, new.title);
  return new;
end;
$$;

-- Covers every client, including the mobile app on this same database.
drop trigger if exists items_flag_age_restricted_trg on public.items;
create trigger items_flag_age_restricted_trg
  before insert or update of url, title on public.items
  for each row execute function public.items_flag_age_restricted();

update public.items
set age_restricted = public.is_age_restricted_user_content(url, title)
where age_restricted is distinct from public.is_age_restricted_user_content(url, title);
