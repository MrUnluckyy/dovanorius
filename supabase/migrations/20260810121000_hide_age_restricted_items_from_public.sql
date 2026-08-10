-- Hide age-flagged items from people who are not part of the board.
--
-- Same two-layer shape as the archived-items work: the RLS policy covers every
-- direct PostgREST read (web, mobile, anything future), and the security definer
-- RPC bypasses RLS so it needs the filter spelled out separately.
--
-- Owners and members still see their own flagged items — the flag was never
-- meant to take something off the user's own list, only to keep it off surfaces
-- we show to strangers. Trade-off: a shared wishlist will not show a flagged
-- item to the gift-giver either. That is the cost of the "hide from public"
-- choice; revisit if it bites.

drop policy if exists "read items (member or board public)" on public.items;
create policy "read items (member or board public)"
  on public.items
  for select
  using (
    archived_at is null
    and (
      is_member(board_id)
      or (
        not age_restricted
        and exists (
          select 1 from boards b
          where b.id = items.board_id and b.is_public
        )
      )
    )
  );

-- get_board_items, regenerated from the live definition:
create or replace function public.get_board_items(p_board_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
        'is_reservable', i.is_reservable,
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
    and i.archived_at is null
    and i.status in ('wanted', 'reserved')
    -- Age-flagged items are visible only to the board's own people.
    and (not i.age_restricted or v_recipient_side);

  return v_result;
end;
$function$;
