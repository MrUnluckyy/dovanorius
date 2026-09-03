-- Retention for client_reports.
--
-- The table holds two kinds of personal data written on an error path: the
-- address someone gave a flow that then failed, and whatever they typed into
-- the report box. Both are worth keeping exactly as long as they are useful
-- for answering the person, and not a day longer.
--
-- Three ages, narrowest first:
--   30d after handling  — you have dealt with it; the reply-to is spent.
--   90d regardless      — an address kept this long will never be written to.
--  365d                 — the whole row goes, free text included. Counts that
--                         old tell you nothing you have not already learned.
create or replace function public.purge_client_reports()
returns void
language sql
set search_path to 'public'
as $function$
  with spent_contacts as (
    update public.client_reports
       set contact_email = null
     where contact_email is not null
       and (
         (handled_at is not null and handled_at < now() - interval '30 days')
         or created_at < now() - interval '90 days'
       )
    returning 1
  )
  delete from public.client_reports
   where created_at < now() - interval '365 days';
$function$;

comment on function public.purge_client_reports() is
  'Retention for client_reports: clears contact_email once it is spent (30d after handling, or 90d regardless) and drops rows over a year old. Runs daily via pg_cron.';

-- 03:40 — after cleanup_purchased_items (03:15), well clear of the 07:00 and
-- 08:00 jobs.
select cron.unschedule('purge-client-reports-daily')
where exists (select 1 from cron.job where jobname = 'purge-client-reports-daily');

select cron.schedule(
  'purge-client-reports-daily',
  '40 3 * * *',
  $$select public.purge_client_reports();$$
);
