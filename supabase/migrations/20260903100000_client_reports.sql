-- Somewhere for a failure to land.
--
-- A total outage of guest reserving (2026-09-02 → 03) was found by watching
-- session recordings, because the only trace on the client was a console.error
-- and a toast that said "Upsss". Nothing reached us.
--
-- Two kinds of row share this table on purpose: the silent beacon the app
-- sends when something fails, and the message a person chooses to leave. They
-- are the same event seen from two sides, and reading them together is how you
-- tell "47 failures, one report" from "one failure, one very annoyed person".
create table if not exists public.client_reports (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- 'error' = automatic beacon. 'report' = a person wrote to us.
  kind          text not null check (kind in ('error', 'report')),
  -- Which flow broke, e.g. 'reserve'. Coarse on purpose: useful for grouping.
  area          text not null,
  -- Machine reason, e.g. 'rpc_failed' | 'auth_failed' | 'captcha_failed'.
  reason        text,
  -- Anything else worth keeping: item id, board id, the driver's message.
  detail        jsonb not null default '{}'::jsonb,

  path          text,
  user_agent    text,
  -- Read from the session server-side, never trusted from the client.
  -- Deliberately NOT a foreign key. This table exists to catch failures, so it
  -- must never be able to fail: a missing profiles row is precisely the kind of
  -- bug we want reported, and an FK would swallow the report instead. (That is
  -- what took guest reserving down on 2026-09-02 — see 20260903090000.)
  user_id       uuid,
  is_guest      boolean,

  -- Only for kind = 'report'.
  message       text,
  contact_email text,

  -- Set when someone on the team has dealt with it.
  handled_at    timestamptz
);

create index if not exists client_reports_triage_idx
  on public.client_reports (created_at desc)
  where handled_at is null;

create index if not exists client_reports_area_reason_idx
  on public.client_reports (area, reason, created_at desc);

-- No policies, deliberately: this table is written and read only through the
-- service role (the /api/report route and the admin area). Nothing the client
-- can reach should be able to read other people's reports.
alter table public.client_reports enable row level security;

comment on table public.client_reports is
  'Client-side failures (automatic beacons) and the messages people leave about them. Service-role access only.';
