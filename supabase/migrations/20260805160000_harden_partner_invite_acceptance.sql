-- Partner invites are bearer links: whoever opens /partner/join/<token> claims
-- the membership. That was tolerable while invites only ever granted 'member',
-- but staff now hand over 'owner' on live merchant accounts, so a link
-- forwarded (or an email thread read by the wrong person) would give away the
-- account. Require the signed-in email to match the address the invite was
-- issued to.
--
-- Also upgrades an existing membership instead of silently doing nothing, so
-- re-inviting a current 'member' as 'owner' actually promotes them.
create or replace function public.accept_partner_invite(p_token text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_invite       partner_invites;
  v_user_id      uuid := auth.uid();
  v_user_email   text;
  v_partner_name text;
begin
  if v_user_id is null then
    return json_build_object('error', 'not_authenticated');
  end if;

  select email into v_user_email from auth.users where id = v_user_id;

  select * into v_invite
  from partner_invites
  where token = p_token
    and accepted_at is null
    and expires_at > now();

  if not found then
    return json_build_object('error', 'invalid_or_expired');
  end if;

  if lower(btrim(v_invite.email)) is distinct from lower(btrim(coalesce(v_user_email, ''))) then
    return json_build_object(
      'error', 'email_mismatch',
      'invited_email', v_invite.email
    );
  end if;

  insert into partner_users (partner_id, user_id, role)
  values (v_invite.partner_id, v_user_id, v_invite.role)
  on conflict (partner_id, user_id) do update
    set role = excluded.role;

  update partner_invites set accepted_at = now() where id = v_invite.id;

  select name into v_partner_name from partners where id = v_invite.partner_id;

  return json_build_object(
    'ok', true,
    'partner_id', v_invite.partner_id,
    'partner_name', v_partner_name
  );
end;
$function$;
