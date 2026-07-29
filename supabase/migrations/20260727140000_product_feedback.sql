-- Relevance feedback (heart / ✕) on inspo products. Feeds the gift engine:
-- disliked products are excluded from retrieval, and both signals fold into the
-- user's taste profile (so recommendations adapt to what they love/reject).
--
-- APPLIED to prod 2026-07-27 via Supabase MCP.
create table if not exists public.product_feedback (
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  -- 1 = like (heart), -1 = dislike (✕)
  signal     smallint not null check (signal in (1, -1)),
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists product_feedback_user_idx
  on public.product_feedback (user_id, signal);

alter table public.product_feedback enable row level security;

-- Users manage only their own feedback.
create policy "own feedback: select" on public.product_feedback
  for select to authenticated using (auth.uid() = user_id);
create policy "own feedback: insert" on public.product_feedback
  for insert to authenticated with check (auth.uid() = user_id);
create policy "own feedback: update" on public.product_feedback
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own feedback: delete" on public.product_feedback
  for delete to authenticated using (auth.uid() = user_id);
