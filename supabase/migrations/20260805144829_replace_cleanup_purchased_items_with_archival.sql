-- Task 5: cleanup_purchased_items() no longer destroys data.
--
-- Previously this deleted every purchased item older than 14 days, which is how
-- ~10 months of purchase history was lost. It now archives instead. The
-- user-facing 14-day window is unchanged.
--
-- coalesce(purchased_at, updated_at) means the older rows with a null
-- purchased_at -- which the delete version silently skipped forever -- are now
-- archived on the same schedule as everything else. Their purchase_events rows
-- were already captured by the backfill.
--
-- The cron job (cleanup_purchased_items_daily, '15 3 * * *') is unchanged: it
-- still calls this function, which now archives instead of deleting.
create or replace function public.cleanup_purchased_items()
returns void
language sql
as $function$
  update public.items
  set archived_at = now()
  where status = 'purchased'
    and archived_at is null
    and coalesce(purchased_at, updated_at) < now() - interval '14 days';
$function$;

comment on function public.cleanup_purchased_items() is
  'Archives purchased items older than 14 days (sets archived_at). Deletes nothing -- purchase history is retained in purchase_events.';
