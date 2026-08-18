-- Board invite links stop expiring.
--
-- The 14-day window was a security reflex, not a product decision, and it broke
-- the ordinary case: you share a board in October for a birthday in December,
-- and the person who finally clicks the link in November is told the invite is
-- invalid. Nothing about a wishlist invite gets more dangerous with age, and
-- the owner already has an explicit revoke (delete the invite row) plus
-- "Atšaukti privačią nuorodą" for the magic link.
--
-- `expires_at` stays on the table as a nullable column so an invite CAN still
-- be given a deadline later; null now means "never expires", and that is the
-- new default. Both readers below accept null.
--
-- HOW TO RUN: paste into the Supabase SQL editor (idempotent).

begin;

alter table public.board_invites
  alter column expires_at drop default,
  alter column expires_at drop not null;

-- Pending invites created under the old rule get the new one; already-accepted
-- rows keep their history untouched.
update public.board_invites
   set expires_at = null
 where accepted_at is null;

create or replace function public.get_board_invite(p_token text)
returns table(board_id uuid, board_name text, board_slug text)
language sql
security definer
set search_path = public
as $$
  select bi.board_id, b.name, b.slug
  from public.board_invites bi
  join public.boards b on b.id = bi.board_id
  where bi.token = p_token
    and bi.accepted_at is null
    and (bi.expires_at is null or bi.expires_at > now())
  limit 1;
$$;

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
    and (expires_at is null or expires_at > now())
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

commit;
