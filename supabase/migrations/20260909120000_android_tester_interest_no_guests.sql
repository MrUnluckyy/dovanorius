-- Keep anonymous sessions out of the tester table.
--
-- The policies as first written granted own-row access to any caller with a
-- uid, and a guest reservation session has one. Nothing leaks — a guest can
-- still only reach their own row — but they have no account and no address to
-- put on the Play list, so a row from one is meaningless data that the invite
-- sender would then try to mail.
--
-- The dashboard already declines to render the prompt for guests. This is the
-- half that does not depend on the UI getting it right.

drop policy if exists "own row: read" on public.android_tester_interest;
drop policy if exists "own row: insert" on public.android_tester_interest;
drop policy if exists "own row: update" on public.android_tester_interest;

create policy "own row: read"
  on public.android_tester_interest for select
  using (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "own row: insert"
  on public.android_tester_interest for insert
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "own row: update"
  on public.android_tester_interest for update
  using (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  )
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );
