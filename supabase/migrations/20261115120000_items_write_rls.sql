-- items: only a board's owner or editor may put an item on it.
--
-- Reported 2026-11-07 (memory: items-insert-rls-hole), fixed here. Three
-- holes, all permissive policies (OR'd):
--   * "insert items (owner/editor)" compared bm.board_id to ITSELF, so it was
--     true for anyone who is owner/editor of ANY board.
--   * "insert own items" checked only created_by = auth.uid(): any signed-in
--     session (guests included) could add an item to anyone's board.
--   * "update own items" checked only created_by on the new row, so an item's
--     author could move it onto anyone's board by changing board_id.
--
-- Checked first: in all 4,014 items, created_by is an owner/editor of the
-- board, so no legitimate flow relied on the loose rules and nothing was
-- planted. Both apps insert with created_by = the user, into a board picked
-- from their own boards; moving an item between boards (web ItemForm, app
-- edit screen) stays allowed between boards the user owns or edits.
-- Reservations and token links go through security-definer RPCs and the
-- service role, which this does not touch.

drop policy if exists "insert own items" on public.items;
drop policy if exists "insert items (owner/editor)" on public.items;

create policy "insert items (owner/editor)" on public.items
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_board_editor_or_owner(board_id, auth.uid())
  );

drop policy if exists "update own items" on public.items;

create policy "update own items" on public.items
  for update to authenticated
  using (created_by = auth.uid())
  with check (
    created_by = auth.uid()
    and public.is_board_editor_or_owner(board_id, auth.uid())
  );
