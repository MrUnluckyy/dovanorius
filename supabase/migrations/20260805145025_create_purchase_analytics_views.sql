-- Task 6: reporting views. Not exposed to the client -- grants are revoked from
-- anon/authenticated below, so only the service role / SQL editor can read them.
-- security_invoker = on keeps them from acting as a privilege-escalation hole
-- (and out of Supabase's "security definer view" advisor).
--
-- NOTE ON VALUE: price is stored per item without normalising currency, so the
-- value columns are a plain sum of whatever currency each row carried. Treat
-- them as indicative until a reporting currency is introduced.
-- NOTE ON DATES: the oldest backfilled rows approximate purchased_at from
-- items.updated_at -- see the backfill_purchase_events migration.

create or replace view public.analytics_purchases_monthly
with (security_invoker = on) as
  select
    date_trunc('month', pe.purchased_at)                         as month,
    count(*)                                                     as purchase_count,
    count(distinct pe.purchaser_id)                              as distinct_buyers,
    sum(pe.price)                                                as total_value,
    round(avg(pe.price), 2)                                      as avg_value,
    percentile_cont(0.5) within group (order by pe.price)        as median_value
  from public.purchase_events pe
  group by 1
  order by 1 desc;

create or replace view public.analytics_purchases_by_merchant
with (security_invoker = on) as
  select
    pe.merchant_domain,
    count(*)              as purchase_count,
    sum(pe.price)         as total_value,
    min(pe.purchased_at)  as first_purchase_at,
    max(pe.purchased_at)  as last_purchase_at
  from public.purchase_events pe
  where pe.merchant_domain is not null
  group by pe.merchant_domain
  order by count(*) desc;

-- Saves = every item ever added, purchased or not. Archived items are counted
-- here on purpose: hiding them is a product concern, not an analytics one.
create or replace view public.analytics_saves_by_merchant
with (security_invoker = on) as
  select
    public.extract_domain(i.url) as merchant_domain,
    count(*)                     as save_count,
    sum(i.price)                 as total_value,
    min(i.created_at)            as first_saved_at,
    max(i.created_at)            as last_saved_at
  from public.items i
  where public.extract_domain(i.url) is not null
  group by public.extract_domain(i.url)
  order by count(*) desc;

revoke all on public.analytics_purchases_monthly     from anon, authenticated;
revoke all on public.analytics_purchases_by_merchant from anon, authenticated;
revoke all on public.analytics_saves_by_merchant     from anon, authenticated;
