-- Guest reservations, round two.
--
-- Three problems reported by real users:
--   1. A 30-day hold is shorter than the gap between "I found a gift" and "it's
--      the birthday". People came back to a reservation that had quietly lapsed.
--   2. The reminder email was optional and shown AFTER reserving, so almost
--      nobody filled it in (1 address across 33 live holds). A hold we cannot
--      email about is a hold the reserver will forget.
--   3. Boards shared by magic link but not marked public returned an empty item
--      list to the very guests the link was made for — and reserve_item refused
--      them, because both gate on `boards.is_public`.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL editor (idempotent).
--
-- TO CHANGE THE WINDOW: edit every `interval '6 months'` below, and keep
-- HOLD_MONTHS in lib/reservationWindow.ts in sync.

begin;

-- ---------------------------------------------------------------------------
-- 1. The hold window: 30 days -> 6 months.
-- ---------------------------------------------------------------------------
create or replace function public.set_reservation_ttl()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'reserved'
     and (tg_op = 'INSERT' or old.status is distinct from 'reserved') then
    new.reserved_at := now();
    new.reserve_expires_at := now() + interval '6 months';
  elsif new.status is distinct from 'reserved' then
    new.reserved_at := null;
    new.reserve_expires_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.renew_reservation(p_item_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  new_expiry timestamptz;
begin
  update public.items
     set reserve_expires_at = now() + interval '6 months',
         reminder_sent_at = null
   where id = p_item_id
     and reserved_by = auth.uid()
     and status = 'reserved'
   returning reserve_expires_at into new_expiry;

  return new_expiry; -- null if nothing was renewed (not owner / not reserved)
end;
$$;

-- Live holds were made under the old promise; give them the new window rather
-- than letting the sweep collect them on the old 30-day clock.
update public.items
   set reserve_expires_at = coalesce(reserved_at, now()) + interval '6 months'
 where status = 'reserved'
   and (reserve_expires_at is null
        or reserve_expires_at < coalesce(reserved_at, now()) + interval '6 months');

-- ---------------------------------------------------------------------------
-- 2. Item payload, factored out so the public and magic-link readers cannot
--    drift apart. Not granted to anon/authenticated: it performs NO access
--    check and is only ever called by the SECURITY DEFINER wrappers below,
--    which run as the owner and do the checking.
-- ---------------------------------------------------------------------------
create or replace function public.board_items_payload(
  p_board_id       uuid,
  p_recipient_side boolean,
  p_viewer         uuid
)
returns jsonb
language sql
stable
set search_path = public
as $$
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
               and p_recipient_side
               and i.reserved_by is distinct from p_viewer
            then 'wanted'
          else i.status
        end,
        'reserved_by', case
          when i.status = 'reserved'
               and p_recipient_side
               and i.reserved_by is distinct from p_viewer
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
  from public.items i
  where i.board_id = p_board_id
    and i.archived_at is null
    and i.status in ('wanted', 'reserved')
    -- Age-flagged items are visible only to the board's own people.
    and (not i.age_restricted or p_recipient_side);
$$;

revoke all on function public.board_items_payload(uuid, boolean, uuid) from public;

create or replace function public.get_board_items(p_board_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_is_public boolean;
  v_is_owner  boolean;
  v_is_member boolean;
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

  return public.board_items_payload(
    p_board_id,
    coalesce(v_is_owner, false) or v_is_member,
    v_uid
  );
end;
$$;

-- Magic-link readers: holding the share token IS the authorisation, exactly as
-- it already is for get_board_by_share_token. Without this, a private board
-- shared by link rendered an empty wishlist to everyone who opened it.
create or replace function public.get_board_items_shared(
  p_board_id    uuid,
  p_share_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_is_public  boolean;
  v_is_owner   boolean;
  v_is_member  boolean;
  v_has_token  boolean;
begin
  select b.is_public,
         (b.owner_id = v_uid),
         (p_share_token is not null and b.share_token = p_share_token)
    into v_is_public, v_is_owner, v_has_token
  from public.boards b
  where b.id = p_board_id;

  if v_is_public is null then
    return '[]'::jsonb; -- board not found
  end if;

  v_is_member := exists (
    select 1 from public.board_members m
    where m.board_id = p_board_id and m.user_id = v_uid
  );

  if not (coalesce(v_is_public, false)
          or coalesce(v_is_owner, false)
          or v_is_member
          or coalesce(v_has_token, false)) then
    return '[]'::jsonb;
  end if;

  return public.board_items_payload(
    p_board_id,
    coalesce(v_is_owner, false) or v_is_member,
    v_uid
  );
end;
$$;

grant execute on function public.get_board_items_shared(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Reserving now carries a contact address.
--
--    A new name rather than a second argument on reserve_item: adding an
--    optional parameter would make the existing `reserve_item(p_item_id => ...)`
--    call ambiguous and break the mobile app, which still uses it.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_item_with_contact(
  p_item_id     uuid,
  p_email       text default null,
  p_share_token uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text := nullif(btrim(lower(coalesce(p_email, ''))), '');
  v_expires timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  -- Signed-in givers already gave us an address; only guests have to type one.
  if v_email is null then
    select lower(btrim(u.email)) into v_email
    from auth.users u
    where u.id = v_uid and nullif(btrim(u.email), '') is not null;
  end if;

  if v_email is null then
    return jsonb_build_object('ok', false, 'error', 'email_required');
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  with target as (
    select i.id
    from public.items i
    join public.boards b on b.id = i.board_id
    where i.id = p_item_id
      and i.archived_at is null
      and i.status = 'wanted'
      and i.reserved_by is null
      and i.is_reservable            -- infinite wishes are never held
      and (
        b.is_public = true
        or (p_share_token is not null and b.share_token = p_share_token)
      )
      -- not the recipient
      and b.owner_id is distinct from v_uid
      -- and not one of the board's collaborators
      and not exists (
        select 1 from public.board_members m
        where m.board_id = i.board_id and m.user_id = v_uid
      )
  )
  update public.items i
     set reserved_by      = v_uid,
         status           = 'reserved',
         reminder_email   = v_email,
         reminder_sent_at = null
    from target
   where i.id = target.id
  returning i.reserve_expires_at into v_expires; -- stamped by set_reservation_ttl

  if v_expires is null then
    return jsonb_build_object('ok', false, 'error', 'unavailable');
  end if;

  return jsonb_build_object('ok', true, 'expires_at', v_expires, 'email', v_email);
end;
$$;

revoke all on function public.reserve_item_with_contact(uuid, text, uuid) from public;
grant execute on function public.reserve_item_with_contact(uuid, text, uuid) to authenticated;

commit;
