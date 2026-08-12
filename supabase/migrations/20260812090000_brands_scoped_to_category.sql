-- Brands available within one category.
--
-- The global list offers adidas while you browse Grožis, which is noise at best
-- and looks broken at worst. Separate from get_inspo_brands() so the unscoped
-- list keeps backing the "all categories" case unchanged.
--
-- Threshold 5, not the global 50: inside one category a brand with five products
-- is a legitimate choice, where globally it would be noise.
create or replace function public.get_inspo_brands_for_type(p_product_type text)
returns table(brand text, n bigint)
language sql stable security definer set search_path = public as $$
  select brand_name, count(*) from public.inspo_products
  where product_type = p_product_type
    and giftable and in_stock
    and brand_name is not null and brand_name <> ''
    and image_url is not null and deep_link is not null
  group by brand_name having count(*) >= 5
  order by count(*) desc, brand_name limit 300;
$$;
grant execute on function public.get_inspo_brands_for_type(text) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
