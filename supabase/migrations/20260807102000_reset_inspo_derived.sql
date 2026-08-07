-- Requeue rows for re-derivation after a rule change (classify_product_type /
-- is_giftable / compute_gift_score): existing rows keep their old values until
-- something writes to them. Driven by scripts/backfill-derived.ts.
--
-- The trigger has to honour a skip flag, because clearing gift_score is itself
-- an UPDATE — without the flag the trigger recomputes the value on the same
-- write, so the "queue it" statement silently became "re-derive the whole table
-- in one statement", which is the timeout the batching exists to avoid.
create or replace function public.inspo_products_derive()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.skip_derive', true), '') = 'on' then
    return new;
  end if;
  new.product_type := public.classify_product_type(new.category_name, new.product_name);
  new.giftable     := public.is_giftable(new.category_name, new.product_name);
  new.gift_score   := public.compute_gift_score(
    new.brand_name, new.product_type, new.price, new.discount_pct,
    new.product_name, new.gender, new.rrp);
  return new;
end;
$$;

create or replace function public.reset_inspo_derived(p_where text default 'true')
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  -- transaction-local: the flag cannot leak into another statement and quietly
  -- stop derivation for real writes.
  perform set_config('app.skip_derive', 'on', true);
  execute format(
    'update public.inspo_products set gift_score = null where gift_score is not null and (%s)',
    p_where
  );
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function public.reset_inspo_derived(text) from public;
grant execute on function public.reset_inspo_derived(text) to service_role;
notify pgrst, 'reload schema';
