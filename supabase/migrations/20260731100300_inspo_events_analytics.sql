-- First-party engagement events for the discover feed. Denormalized (merchant/
-- brand/type/price copied in) so analytics never joins the ~566k feed table.
create table if not exists public.inspo_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('open','save','click_out')),
  product_id text,
  merchant_name text,
  brand_name text,
  product_type text,
  price numeric,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inspo_events_created_idx  on public.inspo_events (created_at);
create index if not exists inspo_events_merchant_idx on public.inspo_events (merchant_name);
create index if not exists inspo_events_brand_idx    on public.inspo_events (brand_name);
create index if not exists inspo_events_type_idx     on public.inspo_events (event_type);

-- Writes go only through the /api/track route (service role). RLS on with no
-- policies → no direct client read/write, so events can't be spoofed or read.
alter table public.inspo_events enable row level security;

-- Readout views (queried via service role / SQL; not granted to anon, so not
-- exposed through the API).
create or replace view public.inspo_merchant_funnel as
select
  coalesce(merchant_name, '(unknown)') as merchant_name,
  count(*) filter (where event_type = 'open')      as opens,
  count(*) filter (where event_type = 'save')      as saves,
  count(*) filter (where event_type = 'click_out') as clicks,
  round(100.0 * count(*) filter (where event_type = 'save')
        / nullif(count(*) filter (where event_type = 'open'), 0), 1) as save_rate_pct,
  round(100.0 * count(*) filter (where event_type = 'click_out')
        / nullif(count(*) filter (where event_type = 'open'), 0), 1) as click_rate_pct
from public.inspo_events
group by 1
order by clicks desc;

create or replace view public.inspo_brand_funnel as
select
  coalesce(brand_name, '(unknown)') as brand_name,
  count(*) filter (where event_type = 'open')      as opens,
  count(*) filter (where event_type = 'save')      as saves,
  count(*) filter (where event_type = 'click_out') as clicks
from public.inspo_events
group by 1
order by clicks desc;
