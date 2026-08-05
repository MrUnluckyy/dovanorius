-- Task 5: soft-hide replaces hard delete.
-- archived_at set => the item is past its 14-day post-purchase window and must
-- not appear anywhere in the product, but the row (and its purchase_event)
-- stays for analytics.
alter table public.items
  add column if not exists archived_at timestamptz;

comment on column public.items.archived_at is
  'Set by cleanup_purchased_items() 14 days after purchase. Archived items are hidden from every product surface but never deleted.';

create index if not exists items_archived_at_idx
  on public.items (archived_at);

-- If an item is ever taken back out of "purchased" (the mobile app has an
-- un-gift action), un-archive it too, so it cannot get stuck permanently
-- invisible.
create or replace function public.clear_archived_on_unpurchase()
returns trigger
language plpgsql
as $function$
begin
  if new.status is distinct from 'purchased' and new.archived_at is not null then
    new.archived_at := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_items_clear_archived_on_unpurchase on public.items;
create trigger trg_items_clear_archived_on_unpurchase
  before update of status on public.items
  for each row
  when (old.status is distinct from new.status)
  execute function public.clear_archived_on_unpurchase();
