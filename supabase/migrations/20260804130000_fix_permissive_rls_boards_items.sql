-- SECURITY FIX: close blanket public-read on boards/items + repair tautological
-- item write policies. Supersedes the never-applied 20260723120000_fix_permissive_rls
-- for the boards/items parts.
--
-- Live bugs this fixes (all confirmed present in production 2026-08-04):
--
--   1. boards carries "Enable read access for all users" with USING (true) for
--      role public, next to the correctly scoped policy. Postgres ORs permissive
--      policies, so the blanket one wins and EVERY board — private included — is
--      readable with the anon key.
--
--   2. items carries "read items" with USING (true) for role public — same leak
--      for every wish item on every board.
--
--   3. items UPDATE/DELETE policies compare bm.board_id = bm.board_id, a
--      tautology: any user who owns/edits ONE board can modify items on EVERY
--      board.
--
-- NOTE — deliberately NOT porting the original migration's part 3 (public read on
-- active partners / partner_products). No public page reads those tables (admin
-- uses supabaseAdmin; the partner portal reads as an authenticated member), and
-- with moderation now live an is_active-only public policy would expose unreviewed
-- 'pending' partner products. Serving happens through inspo_products, not here.
--
-- Safe to drop the blanket reads: unauthenticated read paths go through
-- get_board_by_share_token / get_board_items (both SECURITY DEFINER, bypass RLS),
-- and /b/[slug] + /users read boards with an explicit is_public = true filter via
-- the scoped policy (widened to role public below).

begin;

-- 1. boards: remove the blanket read; widen the scoped policy to anon so public
--    board pages (/b/[slug], /users) keep working for logged-out visitors.
drop policy if exists "Enable read access for all users" on public.boards;
alter policy "boards_select_owner_member_or_public" on public.boards to public;

-- 2. items: remove the blanket read. "read items (member or board public)"
--    already targets role public and resolves correctly for anon (is_member is
--    false, public boards pass).
drop policy if exists "read items" on public.items;

-- 3. items: repair the tautological board check on write policies.
drop policy if exists "update items (owner/editor)" on public.items;
create policy "update items (owner/editor)"
  on public.items for update to authenticated
  using (public.is_board_editor_or_owner(board_id, auth.uid()))
  with check (public.is_board_editor_or_owner(board_id, auth.uid()));

drop policy if exists "delete items (owner/editor)" on public.items;
create policy "delete items (owner/editor)"
  on public.items for delete to authenticated
  using (public.is_board_editor_or_owner(board_id, auth.uid()));

commit;
