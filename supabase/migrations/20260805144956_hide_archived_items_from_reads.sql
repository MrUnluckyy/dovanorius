-- Task 5 (cont.): make archived items invisible on every read path.
--
-- Layer 1 is the RLS SELECT policy: it covers every direct PostgREST read from
-- the web app, the mobile app and any future client, including queries nobody
-- remembered to update. Layers 2 and 3 cover the security definer RPCs and the
-- views, which bypass RLS and therefore need the filter spelled out.

-- ---------------------------------------------------------------- layer 1
drop policy if exists "read items (member or board public)" on public.items;
create policy "read items (member or board public)"
  on public.items
  for select
  using (
    archived_at is null
    and (
      is_member(board_id)
      or exists (
        select 1 from boards b
        where b.id = items.board_id and b.is_public
      )
    )
  );

-- ---------------------------------------------------------------- layer 2
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
        'is_reservable', i.is_reservable,
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
    and i.archived_at is null
    and i.status in ('wanted', 'reserved');

  return v_result;
end;
$function$;

create or replace function public.get_boards_v3()
 returns table(id uuid, name text, description text, is_public boolean, slug text, is_owner boolean, item_count bigint, wanted_count bigint, reserved_count bigint, preview_images text[], last_item_added_at timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
with current_profile as (
  select auth.uid() as id
),
visible_boards as (
  select b.*
  from public.boards b
  join current_profile cp on true
  left join public.board_members bm
    on bm.board_id = b.id
   and bm.user_id = cp.id
  where b.owner_id = cp.id
     or bm.user_id is not null
)
select
  b.id,
  b.name,
  b.description,
  b.is_public,
  b.slug,
  (b.owner_id = cp.id) as is_owner,

  coalesce(s.item_count, 0) as item_count,
  coalesce(s.wanted_count, 0) as wanted_count,
  coalesce(s.reserved_count, 0) as reserved_count,
  coalesce(s.preview_images, '{}'::text[]) as preview_images,
  s.last_item_added_at

from visible_boards b
join current_profile cp on true
left join lateral (
  select
    count(*) filter (where i.status in ('reserved','wanted')) as item_count,
    count(*) filter (where i.status = 'wanted') as wanted_count,
    count(*) filter (where i.status = 'reserved') as reserved_count,
    max(i.created_at) filter (where i.status in ('reserved','wanted')) as last_item_added_at,
    (
      select array_agg(i2.image_url order by i2.created_at desc)
      from public.items i2
      where i2.board_id = b.id
        and i2.archived_at is null
        and i2.image_url is not null
        and i2.status in ('reserved','wanted')
    )[1:3] as preview_images
  from public.items i
  where i.board_id = b.id
    and i.archived_at is null
) s on true;
$function$;

create or replace function public.my_boards_with_personalisation()
 returns table(id uuid, name text, description text, slug text, personalisation jsonb, is_owner boolean, item_count bigint)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with current_profile as (
    select p.id
    from public.profiles p
    where p.id = auth.uid()
  )
  select
    b.id,
    b.name,
    b.description,
    b.slug,
    b.personalisation,
    (b.owner_id = cp.id) as is_owner,
    coalesce(item_stats.item_count, 0) as item_count
  from public.boards b
  join current_profile cp on true
  left join public.board_members bm
    on bm.board_id = b.id
    and bm.user_id = cp.id
  left join lateral (
    select count(*) as item_count
    from public.items i
    where i.board_id = b.id
      and i.archived_at is null
      and i.status in ('reserved', 'wanted')
  ) item_stats on true
  where
    b.owner_id = cp.id
    or bm.user_id is not null;
$function$;

create or replace function public.my_boards_with_previews()
 returns table(id uuid, name text, description text, slug text, is_owner boolean, item_count integer, preview_images text[])
 language sql
 security definer
 set search_path to 'public'
as $function$
with current_profile as (
  select p.id
  from public.profiles p
  where p.id = auth.uid()
)
select
  b.id,
  b.name,
  b.description,
  b.slug,
  (b.owner_id = cp.id) as is_owner,
  coalesce(item_stats.item_count, 0) as item_count,
  coalesce(item_stats.preview_images, '{}'::text[]) as preview_images
from public.boards b
join current_profile cp on true
left join public.board_members bm
  on bm.board_id = b.id
  and bm.user_id = cp.id
left join lateral (
  select
    count(*) as item_count,
    (
      select array_agg(i2.image_url order by i2.created_at desc)
      from public.items i2
      where i2.board_id = b.id
        and i2.archived_at is null
        and i2.image_url is not null
        and i2.status in ('reserved', 'wanted')
    )[1:3] as preview_images
  from public.items i
  where i.board_id = b.id
    and i.archived_at is null
    and i.status in ('reserved', 'wanted')
) item_stats on true
where
  b.owner_id = cp.id
  or bm.user_id is not null;
$function$;

create or replace function public.my_boards_with_previews_2()
 returns table(id uuid, name text, description text, is_public boolean, slug text, is_owner boolean, item_count integer, preview_images text[])
 language sql
 security definer
 set search_path to 'public'
as $function$
with current_profile as (
  select p.id
  from public.profiles p
  where p.id = auth.uid()
)
select
  b.id,
  b.name,
  b.description,
  b.is_public,
  b.slug,
  (b.owner_id = cp.id) as is_owner,
  coalesce(item_stats.item_count, 0) as item_count,
  coalesce(item_stats.preview_images, '{}'::text[]) as preview_images
from public.boards b
join current_profile cp on true
left join public.board_members bm
  on bm.board_id = b.id
  and bm.user_id = cp.id
left join lateral (
  select
    count(*) as item_count,
    (
      select array_agg(i2.image_url order by i2.created_at desc)
      from public.items i2
      where i2.board_id = b.id
        and i2.archived_at is null
        and i2.image_url is not null
        and i2.status in ('reserved', 'wanted')
    )[1:3] as preview_images
  from public.items i
  where i.board_id = b.id
    and i.archived_at is null
    and i.status in ('reserved', 'wanted')
) item_stats on true
where
  b.owner_id = cp.id
  or bm.user_id is not null;
$function$;

create or replace function public.users_boards_with_previews(p_user_id uuid)
 returns table(id uuid, name text, description text, slug text, is_owner boolean, item_count bigint, preview_images text[])
 language sql
 stable security definer
as $function$select
  b.id,
  b.name,
  b.description,
  b.slug,

  -- is this board owned OR editable by the *viewer* (auth.uid())?
  (
    b.owner_id = auth.uid()
    or exists (
      select 1
      from public.board_members bm2
      where bm2.board_id = b.id
        and bm2.user_id = auth.uid()
        and bm2.role = 'editor'
    )
  ) as is_owner,

  -- only wanted + reserved items
  count(i.*)::bigint as item_count,

  coalesce(
    array(
      select i2.image_url
      from public.items i2
      where i2.board_id = b.id
        and i2.archived_at is null
        and i2.image_url is not null
        and i2.status in ('wanted', 'reserved')
      order by i2.created_at desc
      limit 3
    ),
    '{}'
  ) as preview_images
from public.boards b
left join public.items i
  on i.board_id = b.id
  and i.archived_at is null
  and i.status in ('wanted', 'reserved')
where
  (
    b.owner_id = p_user_id
    or exists (
      select 1
      from public.board_members bm
      where bm.board_id = b.id
        and bm.user_id = p_user_id
        and bm.role = 'editor'
    )
  )
  and b.is_public = true
group by b.id;$function$;

create or replace function public.check_item_reserved(p_item_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_board_id uuid;
  v_reserved boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select
    i.board_id,
    (i.reserved_by is not null or i.status in ('reserved', 'purchased'))
  into v_board_id, v_reserved
  from public.items i
  where i.id = p_item_id
    and i.archived_at is null;

  if v_board_id is null then
    raise exception 'Item not found';
  end if;

  -- Caller must own, or be a member of, the board this item belongs to.
  if not exists (
    select 1 from public.boards b
    where b.id = v_board_id and b.owner_id = v_uid
  ) and not exists (
    select 1 from public.board_members m
    where m.board_id = v_board_id and m.user_id = v_uid
  ) then
    raise exception 'Not authorized';
  end if;

  return coalesce(v_reserved, false);
end;
$function$;

-- Reservation RPCs bypass RLS, so without these guards an archived item could
-- be reserved/unreserved by id and resurrected onto a board.
create or replace function public.reserve_item(p_item_id uuid)
 returns boolean
 language sql
 security definer
 set search_path to 'public'
as $function$
  with target as (
    select i.id
    from public.items i
    join public.boards b on b.id = i.board_id
    where i.id = p_item_id
      and i.archived_at is null
      and b.is_public = true
      and i.reserved_by is null
  )
  update public.items i
  set reserved_by = auth.uid(),
      reserved_at = now(),
      status = 'reserved'
  from target
  where i.id = target.id
  returning true;
$function$;

create or replace function public.unreserve_item(p_item_id uuid)
 returns boolean
 language sql
 security definer
 set search_path to 'public'
as $function$
  update public.items
  set reserved_by = null,
      reserved_at = null,
      status = 'wanted'
  where id = p_item_id
    and archived_at is null
    and reserved_by = auth.uid()
  returning true;
$function$;

-- ---------------------------------------------------------------- layer 3
-- User-facing counts must not include archived items.
create or replace view public.boards_with_stats as
 SELECT b.id,
    b.owner_id,
    b.slug,
    b.name,
    b.description,
    b.is_public,
    b.created_at,
    (COALESCE(count(i.id), (0)::bigint))::integer AS item_count,
    max(i.created_at) AS last_item_added_at
   FROM (boards b
     LEFT JOIN items i ON ((i.board_id = b.id) AND i.archived_at IS NULL))
  GROUP BY b.id, b.owner_id, b.slug, b.name, b.description, b.is_public, b.created_at;

create or replace view public.followed_users_with_wish_count as
 SELECT f.follower_id,
    f.followee_id AS user_id,
    p.display_name,
    p.avatar_url,
    count(i.id) AS wish_count
   FROM (((follows f
     JOIN profiles p ON ((p.id = f.followee_id)))
     LEFT JOIN boards b ON (((b.owner_id = f.followee_id) AND (b.is_public = true))))
     LEFT JOIN items i ON (((i.board_id = b.id) AND i.archived_at IS NULL AND ((i.status)::text = ANY (ARRAY['wanted'::text, 'reserved'::text])))))
  GROUP BY f.follower_id, f.followee_id, p.display_name, p.avatar_url;

-- NOT filtered on purpose: public.items_per_domain is an aggregate reporting
-- view with no per-user output. Excluding archived rows there would re-create
-- the undercount this whole change exists to fix.
