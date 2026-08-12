-- Recipient-side users must not be able to reserve.
--
-- reserve_item() checked only that the board was public and the item free, so
-- the board's OWNER or any collaborator could reserve items on their own
-- wishlist — via the UI (Reserve showed for collaborators on the public routes)
-- or by calling the RPC directly.
--
-- Beyond being nonsensical, it corrupts the giving flow: get_board_items masks
-- other people's reservations from recipient-side viewers, so a collaborator
-- sees an already-reserved item as "wanted". Reserving it collides with the real
-- giver, and the failure reveals the item was spoken for — exactly the surprise
-- the masking exists to protect.
--
-- Same ownership/membership test the read path already makes.
create or replace function public.reserve_item(p_item_id uuid)
returns boolean language sql security definer set search_path to 'public'
as $function$
  with target as (
    select i.id
    from public.items i
    join public.boards b on b.id = i.board_id
    where i.id = p_item_id
      and i.archived_at is null
      and b.is_public = true
      and i.reserved_by is null
      and b.owner_id is distinct from auth.uid()
      and not exists (
        select 1 from public.board_members m
        where m.board_id = i.board_id and m.user_id = auth.uid()
      )
  )
  update public.items i
  set reserved_by = auth.uid(), reserved_at = now(), status = 'reserved'
  from target where i.id = target.id
  returning true;
$function$;
