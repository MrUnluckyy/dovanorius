-- contact_email is no longer report-only.
--
-- When guest reserving broke, the only copy of the address each person had
-- typed lived inside the RPC payload — which PostgREST passes as a single
-- bound parameter, so Postgres logged it as `$1` and the value was never
-- written anywhere. Two people were left unreachable and both gave up.
--
-- Failures in a flow that already asked for an address now carry it, so we can
-- tell those people what happened. Same purpose they gave it for.
comment on column public.client_reports.contact_email is
  'Reply-to for this report. Set from what a person wrote, and also captured on failures in flows that already collect an address (reserving). Purge on the retention schedule — this is personal data on an error path.';

comment on column public.client_reports.message is
  'Only set for kind = ''report'': what the person chose to tell us.';
