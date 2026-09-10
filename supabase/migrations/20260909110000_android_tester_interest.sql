-- Who has volunteered to test the Android app, and who has waved the ask away.
--
-- This is opt-in by design. The alternative was mailing every account holder
-- the Play opt-in link, which the privacy policy rules out: it promises we do
-- not use these addresses for marketing, and §3 scopes email to essential
-- notices. A person who fills this in has handed us the address *for this*,
-- which is consent that needs no reinterpreting.
--
-- `google_email` is deliberately separate from the account address. The Play
-- tester list is keyed on a Google account, and roughly a fifth of accounts
-- here are not @gmail.com — for those the address we already hold is the wrong
-- one, and the prompt has to ask.

create table if not exists public.android_tester_interest (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  -- 'dismissed' is a real, stored answer, not the absence of one: the whole
  -- point is that the prompt never comes back on another device.
  status        text not null check (status in ('interested', 'dismissed')),
  google_email  text,
  -- Stamped when the Play opt-in link is actually mailed to this person, so a
  -- second round can tell who is still waiting to hear back.
  invited_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.android_tester_interest enable row level security;

-- Nothing here is readable across users: a row is only ever the owner's own
-- answer. Admin reads go through the service role, which bypasses RLS.
create policy "own row: read"
  on public.android_tester_interest for select
  using (auth.uid() = user_id);

create policy "own row: insert"
  on public.android_tester_interest for insert
  with check (auth.uid() = user_id);

create policy "own row: update"
  on public.android_tester_interest for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The only query the admin side runs: who said yes and has not been mailed yet.
create index if not exists android_tester_interest_status_idx
  on public.android_tester_interest (status, invited_at);
