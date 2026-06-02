-- Fix: accept_board_invite failed with Postgres error 42804 (datatype
-- mismatch). board_members.role is an enum, but the invite's role was passed
-- as a text variable, which does not auto-coerce to an enum on INSERT.
--
-- Fix: inject the role as a quoted SQL literal via format(%L), so it coerces
-- to the column type whether role is text or an enum. Idempotent.
--
-- HOW TO RUN: paste into the Supabase SQL editor.

create or replace function public.accept_board_invite(
  p_token        text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv    public.board_invites;
  v_uid  uuid := auth.uid();
  v_slug text;
  v_name text := nullif(trim(coalesce(p_display_name, '')), '');
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into inv
  from public.board_invites
  where token = p_token
    and accepted_at is null
    and expires_at > now()
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  end if;

  -- Role injected as a SQL literal (%L) so it coerces to the
  -- board_members.role column type (text or enum) without a 42804 mismatch.
  execute format(
    'insert into public.board_members (board_id, user_id, role, display_name)
       values ($1, $2, %L, $3)
     on conflict (board_id, user_id) do update
       set display_name = coalesce($3, public.board_members.display_name)',
    inv.role
  )
  using inv.board_id, v_uid, v_name;

  update public.board_invites set accepted_at = now() where id = inv.id;

  select slug into v_slug from public.boards where id = inv.board_id;

  return jsonb_build_object(
    'ok', true,
    'board_id', inv.board_id,
    'board_slug', v_slug
  );
end;
$$;

revoke all on function public.accept_board_invite(text, text) from public;
grant execute on function public.accept_board_invite(text, text) to authenticated;
