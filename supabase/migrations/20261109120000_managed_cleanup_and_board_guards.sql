-- Follow-ups to ss_managed_members (20261107120000).
--
-- 1. A managed person exists only through events. Their last seat going
--    (removed by the organiser, or the whole event deleted, from the website
--    OR from noriuto-app, which deletes ss_events directly) now deletes them,
--    and with them their wish list. Before this, only the website's
--    removeMember cleaned up, so deleting an event left anonymous users and
--    their boards behind for good.
--
-- 2. boards.owner_id can only be changed by the owner. boards_update_owner_or_editor
--    lets an editor update the row, and the web's EditBoard sent
--    owner_id = <whoever saved>, so an editor saving the board form took it
--    over. (No board in prod had been taken over when this shipped.)
--
-- 3. Anybody may leave a board they were added to (their own non-owner
--    board_members row). Viewers could not before: the delete policy asks
--    for editor or owner.

-- ── 1. Managed person cleanup ───────────────────────────────────────────────
create or replace function public.ss_members_cleanup_managed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from managed_users where user_id = old.user_id) then
    return null;
  end if;
  if exists (select 1 from ss_members where user_id = old.user_id) then
    return null;
  end if;

  -- Never delete anybody who could sign in. Profiles, boards (and their
  -- items), managed_users and every event row cascade from auth.users.
  begin
    delete from auth.users where id = old.user_id and is_anonymous;
  exception when others then
    -- Deleting the event (or the seat) matters more than the tidy-up.
    raise warning 'ss_members_cleanup_managed: could not delete %: %', old.user_id, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function public.ss_members_cleanup_managed() from public, anon, authenticated;

drop trigger if exists ss_members_cleanup_managed on public.ss_members;
create trigger ss_members_cleanup_managed
  after delete on public.ss_members
  for each row execute function public.ss_members_cleanup_managed();

-- People orphaned before this trigger existed.
delete from auth.users u
 using public.managed_users mu
 where mu.user_id = u.id
   and u.is_anonymous
   and not exists (select 1 from public.ss_members m where m.user_id = mu.user_id);

-- ── 2. Only the owner hands a board over ────────────────────────────────────
create or replace function public.boards_guard_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- auth.uid() is null for the service role and for SQL run on the server.
  if new.owner_id is distinct from old.owner_id
     and auth.uid() is not null
     and auth.uid() is distinct from old.owner_id then
    raise exception 'only the owner can change who owns a board'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists boards_guard_owner on public.boards;
create trigger boards_guard_owner
  before update of owner_id on public.boards
  for each row execute function public.boards_guard_owner();

-- ── 3. Leave a board you were added to ──────────────────────────────────────
drop policy if exists board_members_delete_self on public.board_members;
create policy board_members_delete_self on public.board_members
  for delete to authenticated
  using (user_id = auth.uid() and role <> 'owner');
