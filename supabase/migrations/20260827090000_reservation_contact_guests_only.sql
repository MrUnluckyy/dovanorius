-- A reservation contact address is a GUEST-only thing.
--
-- `reserve_item_with_contact` looked an account holder's address up from
-- auth.users and stored it on the item, so a signed-in giver ended up on the
-- reminder mailing path exactly like a guest. But an account holder already has
-- somewhere better to hear it: the dashboard lists their holds, and the
-- notification bell reaches them in-app. Email is the guest's ONLY channel —
-- they keep no account, so the email is their sole record of the hold.
--
-- Guests exist only on the web (the mobile app is gated behind login, so every
-- mobile reserver is signed in). `auth.users.is_anonymous` is therefore the
-- exact discriminator between "must be emailed" and "must not be".
--
-- HOW TO RUN: paste this whole file into the Supabase SQL editor (idempotent).

begin;

-- ---------------------------------------------------------------------------
-- 1. Only guests carry a contact address.
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
  v_is_anon boolean;
  v_expires timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select coalesce(u.is_anonymous, false) into v_is_anon
  from auth.users u
  where u.id = v_uid;

  if v_is_anon then
    -- A guest has no account and no dashboard. Without an address we could
    -- never tell them anything about this hold again, so it stays required.
    if v_email is null then
      return jsonb_build_object('ok', false, 'error', 'email_required');
    end if;

    if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_email');
    end if;
  else
    -- Account holder. Discard any address the client sent: storing one here is
    -- precisely what put signed-in givers back on the mailing path. They are
    -- reached in-app instead.
    v_email := null;
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
         reminder_email   = v_email,   -- null for account holders
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

-- ---------------------------------------------------------------------------
-- 2. Clear addresses already stored against an account holder's hold.
--
--    Deliberately keyed on who the reserver is NOW, not who they were when
--    they reserved: a guest who later upgraded their anonymous session into a
--    real account has somewhere in-app to hear it, so they come off the list
--    too. The cron applies the same live check when choosing recipients.
-- ---------------------------------------------------------------------------
update public.items i
   set reminder_email = null,
       reminder_sent_at = null
  from auth.users u
 where u.id = i.reserved_by
   and not coalesce(u.is_anonymous, false)
   and i.reminder_email is not null;

commit;
