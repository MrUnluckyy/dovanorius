-- Diacritic-insensitive people search.
--
-- `display_name` is stored exactly as typed ("Žygimantas"), so `ilike '%Zyg%'`
-- matches nothing — and typing without Lithuanian letters is how most people
-- search, especially on a phone keyboard set to English. Storing a folded copy
-- of the name gives the client a column it can query with an equally folded
-- term, so "Zyg", "žyg" and "ZYG" all reach the same person.
--
-- The folding lives in the database rather than in the query because the *data*
-- is what carries the accents; normalising only the search term would fix
-- nothing.

create extension if not exists unaccent with schema extensions;

-- unaccent() is STABLE, not IMMUTABLE — it reads a text-search dictionary that
-- could in principle be redefined. A generated column requires IMMUTABLE, so we
-- pin the dictionary by name: with the dictionary fixed the result really is
-- deterministic, which is what the marker promises. This is the standard
-- Postgres workaround, and the cost of it is that changing the dictionary later
-- would leave stored values stale until the column is rebuilt.
create or replace function public.nr_unaccent(txt text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, txt)
$$;

comment on function public.nr_unaccent(text) is
  'Immutable unaccent() with the dictionary pinned, so it can be used in generated columns and indexes.';

alter table public.profiles
  add column if not exists display_name_norm text
  generated always as (lower(public.nr_unaccent(display_name))) stored;

comment on column public.profiles.display_name_norm is
  'Lowercased, unaccented display_name for diacritic-insensitive search. Generated — never write to it. Clients must fold the search term the same way (utils/search.ts foldForSearch).';

-- Same access pattern as the name column it mirrors: ilike '%term%', which only
-- a trigram index can serve.
create index if not exists profiles_display_name_norm_trgm_idx
  on public.profiles using gin (display_name_norm public.gin_trgm_ops);
