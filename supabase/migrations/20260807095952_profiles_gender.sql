-- Self-declared, optional. Discover preselects its audience from this; when it
-- is null the client falls back to profiles.discover_audience (the last choice
-- made on the page), then to "everyone". Nothing forces the user to answer.
alter table public.profiles
  add column if not exists gender text
  check (gender is null or gender in ('female','male','other'));

comment on column public.profiles.gender is
  'Optional self-declared gender. Seeds the discover audience filter; never required.';
