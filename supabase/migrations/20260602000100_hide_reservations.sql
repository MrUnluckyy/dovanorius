-- Privacy: hide reservation status from the "recipient side" of a board
-- (the owner + invited collaborators/members), so surprises aren't spoiled.
-- Outside gift-givers (non-members) still see reservations to coordinate.
-- Everyone always sees their OWN reservation.
--
-- This is enforced at the DATA layer: recipient-side callers never receive
-- reserved_by, and reserved items are reported as "wanted" to them.
--
-- HOW TO RUN: paste into the Supabase SQL editor (idempotent).

create or replace function public.get_board_items(p_board_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_is_public      boolean;
  v_is_owner       boolean;
  v_is_member      boolean;
  v_recipient_side boolean;
  v_result         jsonb;
begin
  select b.is_public, (b.owner_id = v_uid)
    into v_is_public, v_is_owner
  from public.boards b
  where b.id = p_board_id;

  if v_is_public is null then
    return '[]'::jsonb; -- board not found
  end if;

  v_is_member := exists (
    select 1 from public.board_members m
    where m.board_id = p_board_id and m.user_id = v_uid
  );

  -- No access at all → nothing.
  if not (coalesce(v_is_public, false) or coalesce(v_is_owner, false) or v_is_member) then
    return '[]'::jsonb;
  end if;

  v_recipient_side := coalesce(v_is_owner, false) or v_is_member;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'board_id', i.board_id,
        'title', i.title,
        'notes', i.notes,
        'price', i.price,
        'image_url', i.image_url,
        'image_urls', i.image_urls,
        'url', i.url,
        -- Mask reservations made by OTHERS from recipient-side viewers.
        'status', case
          when i.status = 'reserved'
               and v_recipient_side
               and i.reserved_by is distinct from v_uid
            then 'wanted'
          else i.status
        end,
        'reserved_by', case
          when i.status = 'reserved'
               and v_recipient_side
               and i.reserved_by is distinct from v_uid
            then null
          else i.reserved_by
        end,
        'reserve_expires_at', i.reserve_expires_at,
        'priority', i.priority,
        'created_at', i.created_at
      )
      order by i.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.items i
  where i.board_id = p_board_id
    and i.status in ('wanted', 'reserved');

  return v_result;
end;
$$;

revoke all on function public.get_board_items(uuid) from public;
grant execute on function public.get_board_items(uuid) to anon, authenticated;
