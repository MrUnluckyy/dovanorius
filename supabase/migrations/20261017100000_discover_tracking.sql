-- Discover tracking (T1 of dev-issue-discover-premium).
--
-- inspo_events only knew open / save / click_out, with no session and no page
-- view, so "left discover without opening anything" could not be measured.
-- This adds a session id, a small context object and the page-level events the
-- first view and the nudge will emit. Additive only: existing writers (web and
-- noriuto-app, both through /api/track) keep working unchanged.

alter table public.inspo_events
  add column if not exists session_id text,
  add column if not exists context jsonb;

-- Widen the type list. Every existing row still passes.
alter table public.inspo_events drop constraint if exists inspo_events_event_type_check;
alter table public.inspo_events add constraint inspo_events_event_type_check
  check (event_type in (
    'open', 'save', 'click_out',
    'discover_view',
    'recipient_selected',
    'nudge_shown', 'nudge_answered', 'nudge_dismissed'
  ));

create index if not exists inspo_events_session_idx
  on public.inspo_events (session_id, created_at)
  where session_id is not null;

-- Bounce per day and first-view state: a session that viewed a discover page
-- and never opened a product. Sessions without a discover_view (older rows,
-- events from surfaces that do not send one) are left out on purpose, so the
-- rate is not diluted by sessions we cannot see the start of.
create or replace view public.discover_session_funnel
  with (security_invoker = true) as
with sessions as (
  select
    session_id,
    min(created_at) as started_at,
    (array_agg(context->>'state' order by created_at)
      filter (where event_type = 'discover_view'))[1] as first_state,
    count(*) filter (where event_type = 'discover_view') as views,
    count(*) filter (where event_type = 'open') as opens,
    count(*) filter (where event_type = 'save') as saves,
    count(*) filter (where event_type = 'click_out') as clicks
  from public.inspo_events
  where session_id is not null
  group by session_id
  having count(*) filter (where event_type = 'discover_view') > 0
)
select
  (started_at at time zone 'Europe/Vilnius')::date as day,
  coalesce(first_state, '(none)') as state,
  count(*) as sessions,
  count(*) filter (where opens = 0) as bounced,
  round(100.0 * count(*) filter (where opens = 0) / nullif(count(*), 0), 1) as bounce_pct,
  count(*) filter (where clicks > 0) as clicked_out
from sessions
group by 1, 2;

-- Nudge funnel per question, for T3. Empty until the nudge ships.
create or replace view public.discover_nudge_funnel
  with (security_invoker = true) as
select
  context->>'question' as question,
  count(*) filter (where event_type = 'nudge_shown') as shown,
  count(*) filter (where event_type = 'nudge_answered') as answered,
  count(*) filter (where event_type = 'nudge_dismissed') as dismissed
from public.inspo_events
where event_type in ('nudge_shown', 'nudge_answered', 'nudge_dismissed')
group by 1;

-- Same rule as the other readout views: service role and SQL only. Supabase's
-- default privileges would otherwise expose these through the API.
revoke all on public.discover_session_funnel from anon, authenticated;
revoke all on public.discover_nudge_funnel from anon, authenticated;
