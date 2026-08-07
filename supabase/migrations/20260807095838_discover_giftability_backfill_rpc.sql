-- Shrinking partial index: finding the next unbackfilled slice stays instant
-- however far the backfill has progressed, and it disappears when done.
create index if not exists inspo_products_backfill_idx
  on public.inspo_products (id) where gift_score is null;

-- Touch a bounded slice; the BEFORE UPDATE trigger does the derivation. Batched
-- because inspo_products carries a GIN trigram index on product_name, so even
-- an eighth of the table in one statement exceeds the request timeout.
-- Driven by scripts/backfill-derived.ts.
create or replace function public.backfill_inspo_derived(p_batch integer default 2000)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_ids text[];
  v_n integer;
begin
  select array_agg(id) into v_ids
  from (select id from public.inspo_products where gift_score is null limit p_batch) s;

  if v_ids is null then return 0; end if;

  update public.inspo_products set synced_at = synced_at where id = any(v_ids);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

grant execute on function public.backfill_inspo_derived(integer) to service_role;
notify pgrst, 'reload schema';
