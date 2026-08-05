-- Task 2: capture the purchase at the moment it happens, not at cleanup time.
-- security definer so it can write to purchase_events (RLS on, no insert policy)
-- and read boards.owner_id regardless of the caller's own visibility.
create or replace function public.record_purchase_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_owner_id     uuid;
  v_purchased_at timestamptz;
begin
  -- BEFORE trigger set_items_purchased_at normally fills this in; fall back to
  -- now() for direct writes that bypass it.
  v_purchased_at := coalesce(new.purchased_at, now());

  select b.owner_id into v_owner_id
  from public.boards b
  where b.id = new.board_id;

  insert into public.purchase_events (
    item_id, board_id, purchaser_id, owner_id, title, price, currency,
    url, merchant_domain, item_created_at, purchased_at
  )
  values (
    new.id, new.board_id, new.reserved_by, v_owner_id, new.title, new.price,
    new.currency, new.url, public.extract_domain(new.url),
    new.created_at, v_purchased_at
  )
  -- Idempotent: re-marking the same item purchased at the same instant is a
  -- no-op rather than a duplicate analytics row.
  on conflict (item_id, purchased_at) do nothing;

  return null; -- AFTER trigger, return value is ignored
end;
$function$;

drop trigger if exists trg_items_record_purchase_update on public.items;
create trigger trg_items_record_purchase_update
  after update on public.items
  for each row
  when (old.status is distinct from new.status and new.status = 'purchased')
  execute function public.record_purchase_event();

drop trigger if exists trg_items_record_purchase_insert on public.items;
create trigger trg_items_record_purchase_insert
  after insert on public.items
  for each row
  when (new.status = 'purchased')
  execute function public.record_purchase_event();
