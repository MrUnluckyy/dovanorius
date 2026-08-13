-- Per-shelf health, so the weekly curator can skip what does not need rebuilding.
--
-- Counts only picks whose product is still in stock, because that is what the
-- page actually renders: usePersonaPicks drops out-of-stock rows, so a shelf can
-- hold 20 picks and display 3. Counting rows would let the curator call a shelf
-- healthy while it looks broken.
--
-- An RPC rather than a client-side group-by because PostgREST caps responses at
-- 1000 rows and a full curation stores up to 17 x 40 = 680 picks -- close enough
-- to the cap that a future KEEP_PER_PERSONA bump would silently truncate the
-- count and make drained shelves look healthy.

create or replace function public.persona_shelf_health()
returns table (persona_id uuid, slug text, in_stock_picks integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         p.slug,
         count(ip.id) filter (where ip.in_stock)::integer
  from gift_personas p
  left join persona_products pp on pp.persona_id = p.id
  left join inspo_products ip on ip.id = pp.product_id
  where p.is_active
  group by p.id, p.slug
$$;

revoke all on function public.persona_shelf_health() from public, anon, authenticated;
grant execute on function public.persona_shelf_health() to service_role;

comment on function public.persona_shelf_health() is
  'In-stock pick count per active shelf. Drives the incremental persona refresh.';
