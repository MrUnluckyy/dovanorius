-- Advisor follow-up for the objects added by the purchase-history change:
--   1. pin search_path on the three new/rewritten functions
--   2. take the two trigger functions off the public RPC surface
-- No behavioural change.

create or replace function public.extract_domain(url text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              lower(btrim(coalesce(url, ''))),
              '^[a-z][a-z0-9+.-]*://', ''
            ),
            '^[^/@]*@', ''
          ),
          '[/?#].*$', ''
        ),
        ':[0-9]+$', ''
      ),
      '^www\.', ''
    ),
    ''
  );
$function$;

create or replace function public.clear_archived_on_unpurchase()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status is distinct from 'purchased' and new.archived_at is not null then
    new.archived_at := null;
  end if;
  return new;
end;
$function$;

create or replace function public.cleanup_purchased_items()
returns void
language sql
set search_path to 'public'
as $function$
  update public.items
  set archived_at = now()
  where status = 'purchased'
    and archived_at is null
    and coalesce(purchased_at, updated_at) < now() - interval '14 days';
$function$;

-- Trigger functions have no business being callable over PostgREST.
revoke all on function public.record_purchase_event() from anon, authenticated;
revoke all on function public.clear_archived_on_unpurchase() from anon, authenticated;
