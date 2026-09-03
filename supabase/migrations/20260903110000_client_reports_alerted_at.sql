-- Exactly-once alerting.
--
-- A lookback window ("anything from the last hour") either double-sends when
-- the windows overlap or drops rows when a run is late. Marking what has been
-- alerted on is exact, and costs one column.
alter table public.client_reports
  add column if not exists alerted_at timestamptz;

-- The alert cron's whole query: unhandled, not yet alerted, oldest first.
create index if not exists client_reports_pending_alert_idx
  on public.client_reports (created_at)
  where alerted_at is null and handled_at is null;
