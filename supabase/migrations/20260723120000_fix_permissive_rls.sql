-- ⚠️ SUPERSEDED — DO NOT APPLY. Never ran against production.
--   * boards/items parts (1 & 2) were applied 2026-08-04 via
--     20260804130000_fix_permissive_rls_boards_items.sql.
--   * part 3 (public read on active partners / partner_products) is intentionally
--     dropped: no public consumer, and with product moderation now live an
--     is_active-only public policy would expose unreviewed 'pending' rows.
-- Kept for history only.
--
-- Fixes three RLS problems found while adding public blog pages.
--
-- 1. `boards` and `items` each carry a blanket `USING (true)` SELECT policy for
--    role `public`, sitting next to a correctly scoped one. Postgres ORs
--    permissive policies together, so the blanket policy wins and every board
--    and wish item — private ones included — is readable with the anon key.
--
-- 2. The `items` UPDATE/DELETE policies compare `bm.board_id = bm.board_id`,
--    a tautology. Any user who owns or edits one board can modify items on
--    every board.
--
-- 3. `partners` / `partner_products` are readable only by partner members, so
--    public brand pages render nothing.
--
-- Safe to drop the permissive read policies: the unauthenticated read paths go
-- through `get_board_by_share_token` and `get_board_items`, both SECURITY
-- DEFINER, so they bypass RLS and are unaffected. `/b/[slug]` already filters
-- on `is_public = true`.

begin;

-- ---------------------------------------------------------------------------
-- 1a. boards: remove the blanket read, widen the scoped policy to anon.
-- ---------------------------------------------------------------------------
drop policy if exists "Enable read access for all users" on public.boards;

-- Was {authenticated} only; anonymous visitors need public boards for
-- /b/[slug] and /users.
alter policy "boards_select_owner_member_or_public" on public.boards to public;

-- ---------------------------------------------------------------------------
-- 1b. items: remove the blanket read. The scoped policy
--     "read items (member or board public)" already targets role `public` and
--     resolves correctly for anon (is_member() is false, public boards pass).
-- ---------------------------------------------------------------------------
drop policy if exists "read items" on public.items;

-- ---------------------------------------------------------------------------
-- 2. items: repair the tautological board check on write policies.
-- ---------------------------------------------------------------------------
drop policy if exists "update items (owner/editor)" on public.items;
create policy "update items (owner/editor)"
  on public.items for update to authenticated
  using (public.is_board_editor_or_owner(board_id, auth.uid()))
  with check (public.is_board_editor_or_owner(board_id, auth.uid()));

drop policy if exists "delete items (owner/editor)" on public.items;
create policy "delete items (owner/editor)"
  on public.items for delete to authenticated
  using (public.is_board_editor_or_owner(board_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. partners / partner_products: public read, limited to active rows.
--    Member-only policies stay in place for the partner admin area.
-- ---------------------------------------------------------------------------
create policy "public can read active partners"
  on public.partners for select to public
  using (is_active);

create policy "public can read active partner products"
  on public.partner_products for select to public
  using (
    is_active
    and exists (
      select 1 from public.partners p
      where p.id = partner_products.partner_id and p.is_active
    )
  );

commit;
