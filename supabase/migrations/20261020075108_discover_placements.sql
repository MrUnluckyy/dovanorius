-- Sponsored placements on discover (the "ads" half of the story slot).
--
-- One format with the gift guides: a large image, a headline, a line of text
-- and up to six products, labelled "Remiama · <advertiser>" (EU and LT rules
-- require ads to be marked). Scheduled from /admin/placements, the same way
-- editorial shelves are. Additive only.

create table if not exists public.discover_placements (
  id uuid primary key default gen_random_uuid(),
  advertiser text not null check (length(advertiser) between 1 and 60),
  headline text not null check (length(headline) between 1 and 120),
  body text check (body is null or length(body) <= 280),
  image_url text not null,
  cta_label text not null default 'Apsilankyti' check (length(cta_label) between 1 and 30),
  cta_url text not null check (cta_url ~ '^https://'),
  product_ids text[] not null default '{}' check (cardinality(product_ids) <= 6),
  -- Recipient keys (lib/discover/recipients.ts); empty = every recipient page.
  recipients text[] not null default '{}',
  -- product_type values; empty = any category. A placement with categories
  -- only shows on those category pages.
  categories text[] not null default '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  -- Higher wins when several placements match the same page.
  priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists discover_placements_live_idx
  on public.discover_placements (priority desc, created_at desc)
  where is_active;

alter table public.discover_placements enable row level security;

-- The public sees only what is live right now; writes go through the admin's
-- server actions (service role), so there are no write policies at all.
drop policy if exists discover_placements_read on public.discover_placements;
create policy discover_placements_read on public.discover_placements
  for select to anon, authenticated
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

-- Image storage. Public read, so the page can render the image; uploads only
-- via the service role (no insert policy for clients).
insert into storage.buckets (id, name, public)
values ('discover-placements', 'discover-placements', true)
on conflict (id) do nothing;

-- Impressions and clicks, in the same table as every other discover event.
alter table public.inspo_events drop constraint if exists inspo_events_event_type_check;
alter table public.inspo_events add constraint inspo_events_event_type_check
  check (event_type in (
    'open', 'save', 'click_out',
    'discover_view',
    'recipient_selected',
    'nudge_shown', 'nudge_answered', 'nudge_dismissed',
    'ad_view', 'ad_click'
  ));

-- Per placement, per day: what an advertiser is told. Unique sessions, so a
-- visitor scrolling past twice is one view.
create or replace view public.discover_ad_stats
  with (security_invoker = true) as
select
  (context->>'placement')::uuid as placement_id,
  (created_at at time zone 'Europe/Vilnius')::date as day,
  count(distinct session_id) filter (where event_type = 'ad_view') as views,
  count(distinct session_id) filter (where event_type = 'ad_click') as clicks
from public.inspo_events
where event_type in ('ad_view', 'ad_click')
  and context->>'placement' ~ '^[0-9a-f-]{36}$'
group by 1, 2;

revoke all on public.discover_ad_stats from anon, authenticated;
