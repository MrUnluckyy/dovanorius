-- Fast substring search for the discover feed (ILIKE '%term%' went ~377ms → ~3ms).
create extension if not exists pg_trgm;
create index if not exists inspo_products_name_trgm_idx
  on public.inspo_products using gin (product_name gin_trgm_ops);

-- User-reported item corrections (wrong category/gender/etc) — feeds data-quality
-- fixes back into classify.ts.
create table if not exists public.inspo_corrections (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.inspo_products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  issue text not null check (issue in ('wrong_category','wrong_gender','not_a_gift','other')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists inspo_corrections_product_idx
  on public.inspo_corrections (product_id);

alter table public.inspo_corrections enable row level security;

create policy "corrections_insert_own"
  on public.inspo_corrections for insert to authenticated
  with check (auth.uid() = user_id);

grant insert on public.inspo_corrections to authenticated;
