-- Editorial shelves: hand-picked in /admin, scheduled, immune to the curator.
--
-- A third `kind` rather than a new table, because a shelf is already a persona
-- row: it inherits PersonaShelf, usePersonas, sort_order and the lt/en labels.
-- What it does NOT inherit is the weekly LLM pass — see the guards in
-- scripts/refresh-personas.ts and lib/personas/refresh.ts, which must land with
-- this migration or the first Monday after a curator hand-picks a shelf will
-- replace their work with model output and say nothing.

alter table public.gift_personas drop constraint if exists gift_personas_kind_check;
alter table public.gift_personas
  add constraint gift_personas_kind_check
  check (kind in ('recipient', 'theme', 'editorial'));

comment on column public.gift_personas.kind is
  'recipient = chosen by the shopper from the picker; theme = an editorial shelf rendered inline, LLM-curated; editorial = hand-picked in /admin and never touched by the weekly curator.';

-- Scheduling. Null on both ends means "live whenever is_active" — which is
-- every existing persona, so this is a no-op for them.
alter table public.gift_personas add column if not exists starts_at timestamptz;
alter table public.gift_personas add column if not exists ends_at timestamptz;

comment on column public.gift_personas.starts_at is
  'Inclusive. Before this the shelf is not merely hidden, it is not fetchable — the SELECT policy excludes it. Null = live now.';
comment on column public.gift_personas.ends_at is
  'Exclusive. Null = never expires.';

-- The window is enforced in RLS, not in the client.
--
-- A seasonal shelf staged a week early is a business fact sitting in a
-- public-read table; hiding it in the hook would still serve it to anyone who
-- opened the network tab. Admin is unaffected because it reads through the
-- service role, which bypasses RLS entirely.
drop policy if exists gift_personas_read on public.gift_personas;
create policy gift_personas_read on public.gift_personas
  for select
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

-- The curator's intent, deliberately outside the cascade.
--
-- persona_products.product_id references inspo_products ON DELETE CASCADE, and
-- the nightly import prunes anything that leaves a merchant feed. For LLM
-- shelves that is correct — the next refresh refills them. For a hand-picked
-- shelf it destroys work with no trace: on 2026-08-12 Pigu's feed went 95k ->
-- 16,868 rows and took eight shelves to zero in a single import.
--
-- So this table holds what the curator chose, keyed on product_id as plain text
-- with NO foreign key, plus a snapshot of the name and image at pick time. When
-- a product disappears the row survives, and admin can say "3 picks dropped out
-- of the feed: Kalėdinė žvakė, ..." instead of quietly showing a shorter shelf.
-- If the product returns to the catalogue, the next sync puts it back.
create table if not exists public.editorial_picks (
  persona_id uuid not null references public.gift_personas(id) on delete cascade,
  product_id text not null,
  rank int not null default 100,
  reason text,
  -- Captured at pick time so a vanished product is still nameable in admin.
  name_snapshot text,
  image_snapshot text,
  added_at timestamptz not null default now(),
  primary key (persona_id, product_id)
);

create index if not exists editorial_picks_persona_rank_idx
  on public.editorial_picks (persona_id, rank);

-- RLS on with no policies: service role only. Picks are staff-authored and the
-- public reads them through persona_products, never from here.
alter table public.editorial_picks enable row level security;

/**
 * Project editorial_picks onto persona_products, which is what the page reads.
 *
 * Only picks whose product still exists in the catalogue are projected — that
 * is what keeps the persona_products foreign key satisfiable while the intent
 * table keeps the full list. Deliberately does NOT filter in_stock: an
 * out-of-stock pick is a different state from a deleted one, admin distinguishes
 * them, and the client already hides out-of-stock at render time.
 *
 * Safe to call repeatedly. Pass a persona id to sync one shelf, or null for all.
 */
create or replace function public.sync_editorial_picks(p_persona_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  synced int;
begin
  delete from persona_products pp
  using gift_personas gp
  where pp.persona_id = gp.id
    and gp.kind = 'editorial'
    and (p_persona_id is null or gp.id = p_persona_id);

  insert into persona_products (persona_id, product_id, rank, reason, refreshed_at)
  select ep.persona_id, ep.product_id, ep.rank, ep.reason, now()
  from editorial_picks ep
  join gift_personas gp on gp.id = ep.persona_id and gp.kind = 'editorial'
  join inspo_products ip on ip.id = ep.product_id
  where (p_persona_id is null or ep.persona_id = p_persona_id);

  get diagnostics synced = row_count;
  return synced;
end;
$$;

revoke execute on function public.sync_editorial_picks(uuid) from public, anon, authenticated;
grant execute on function public.sync_editorial_picks(uuid) to service_role;

comment on function public.sync_editorial_picks(uuid) is
  'Rebuild persona_products for editorial shelves from editorial_picks. Call after any admin pick edit, and nightly after the import so picks that returned to the feed come back.';
