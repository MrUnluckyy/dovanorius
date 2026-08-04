-- Project approved partner_products into inspo_products (the served feed).
--
-- An approved partner product becomes a served row with id 'partner:<uuid>',
-- source='partner', network='direct', deep_link=product_url. Any status other
-- than 'approved' — or a delete — retracts the served row. A trigger does this
-- so the projection stays correct no matter who changes the source row (admin
-- review action, partner edit that resets it to 'pending', or a delete).
--
-- Discover's read gate (in_stock + image_url + deep_link + price >= 10) is
-- unchanged; an approved product with a missing image or sub-floor price simply
-- won't surface, exactly like affiliate rows.

begin;

-- Partner rows have no affiliate network — allow a 'direct' network value.
alter table public.inspo_products drop constraint if exists inspo_products_network_check;
alter table public.inspo_products add constraint inspo_products_network_check
  check (network in ('awin', 'tradedoubler', 'direct'));

create or replace function public.sync_partner_product_projection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand text;
begin
  if tg_op = 'DELETE' then
    delete from public.inspo_products where id = 'partner:' || old.id;
    return old;
  end if;

  -- INSERT / UPDATE: project only approved rows that have a destination URL
  -- (deep_link is NOT NULL on inspo_products); everything else is retracted.
  if new.status = 'approved' and new.product_url is not null then
    select name into v_brand from public.partners where id = new.partner_id;

    insert into public.inspo_products as t (
      id, source, partner_id, network, product_name, image_url, deep_link,
      price, currency, brand_name, merchant_name, category_name, gender,
      in_stock, suitable_for, synced_at
    ) values (
      'partner:' || new.id, 'partner', new.partner_id, 'direct', new.title,
      new.image_url, new.product_url, new.price, coalesce(new.currency, 'EUR'),
      v_brand, v_brand,
      (case when array_length(new.categories, 1) > 0 then new.categories[1] end),
      new.gender, coalesce(new.is_active, true), 'all', now()
    )
    on conflict (id) do update set
      product_name  = excluded.product_name,
      image_url     = excluded.image_url,
      deep_link     = excluded.deep_link,
      price         = excluded.price,
      currency      = excluded.currency,
      brand_name    = excluded.brand_name,
      merchant_name = excluded.merchant_name,
      category_name = excluded.category_name,
      gender        = excluded.gender,
      in_stock      = excluded.in_stock,
      partner_id    = excluded.partner_id,
      source        = 'partner',
      network       = 'direct',
      synced_at     = now();
  else
    delete from public.inspo_products where id = 'partner:' || new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists partner_product_projection on public.partner_products;
create trigger partner_product_projection
  after insert or update or delete on public.partner_products
  for each row execute function public.sync_partner_product_projection();

commit;

notify pgrst, 'reload schema';
