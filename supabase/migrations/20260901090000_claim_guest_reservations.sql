-- Move a guest's holds into the account they belong to.
--
-- Anonymous sessions look exactly like being logged in (they were, in the nav,
-- until 2026-08-31), so account holders reserved as guests without noticing:
-- 8 of the 13 guest holds carrying an email belonged to an account that
-- already existed. Those gifts sit in an anonymous session the owner can never
-- open — clear the cookie and the only way back is the release link in the
-- confirmation email.
--
-- The address a guest typed is the only thread connecting the two. When
-- someone signs in and proves that same address, the hold follows them.
create or replace function public.claim_guest_reservations()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_count integer;
begin
  if v_uid is null then
    return 0;
  end if;

  -- Identity comes from auth.users, never from a parameter: this verified
  -- address is the entire authorisation for moving somebody else's row.
  -- An unconfirmed signup must not be able to harvest holds by claiming an
  -- address it has not proven.
  select lower(u.email)
    into v_email
    from auth.users u
   where u.id = v_uid
     and u.is_anonymous is not true
     and u.email_confirmed_at is not null
     and u.email is not null;

  if v_email is null then
    return 0;
  end if;

  with claimed as (
    update public.items i
       set reserved_by    = v_uid,
           -- Channel split: account holders hear about reservations through
           -- the bell, so the address that drove the guest emails goes.
           reminder_email = null
      from auth.users g
     where g.id = i.reserved_by
       and g.is_anonymous
       and i.reserved_by <> v_uid
       and lower(trim(i.reminder_email)) = v_email
       -- Only live holds. A purchased item has already done its job and its
       -- history lives in purchase_events; re-pointing reserved_by there
       -- would rewrite who bought what.
       and i.status = 'reserved'
       and i.archived_at is null
    returning i.id
  )
  select count(*) into v_count from claimed;

  return v_count;
end;
$$;

comment on function public.claim_guest_reservations() is
  'Reassigns reservations held by anonymous sessions to the calling account when the guest-supplied reminder_email matches the caller''s verified address. Returns the number moved.';

revoke all on function public.claim_guest_reservations() from public, anon;
grant execute on function public.claim_guest_reservations() to authenticated;
