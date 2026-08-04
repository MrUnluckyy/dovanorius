-- Phase 1 of the unified product feed: partner moderation + inspo source tagging.
--
-- Two authoring worlds converge on inspo_products (the only table discover
-- reads): affiliate rows land via the feed importer; partner rows are projected
-- in only after an admin approves them. This migration lays the groundwork:
--
--   1. inspo_products.source / partner_id  — tag every served row + backlink
--                                            projected partner rows to their partner
--   2. partner_products moderation columns — status + review audit trail
--   3. is_admin() helper                   — gates the /admin moderation queue
--   4. RLS: partners create/edit only 'pending' rows; admins read all + review
--
-- Discover serving is unchanged: it already gates on in_stock + image_url +
-- deep_link + price, and only *approved* partner rows are ever projected in.

begin;

-- ---------------------------------------------------------------------------
-- 1. inspo_products: where did this row come from, and (if partner) which one.
--    Every existing row is an affiliate import, so the default backfills them.
-- ---------------------------------------------------------------------------
alter table public.inspo_products
  add column if not exists source text not null default 'affiliate'
    check (source in ('affiliate', 'partner')),
  add column if not exists partner_id uuid references public.partners(id) on delete cascade;

-- Lookups when re-projecting or retracting a partner's approved rows.
create index if not exists inspo_products_partner_idx
  on public.inspo_products (partner_id) where partner_id is not null;

-- ---------------------------------------------------------------------------
-- 2. partner_products: moderation state + review audit.
--    Nothing is surfaced yet, so existing rows default to 'pending' — they
--    enter the same review queue as new uploads rather than going live unseen.
-- ---------------------------------------------------------------------------
alter table public.partner_products
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists rejection_reason text;

-- Admin queue: oldest pending first.
create index if not exists partner_products_status_idx
  on public.partner_products (status, created_at);

-- ---------------------------------------------------------------------------
-- 3. is_admin(): internal platform admin, gated by profiles.is_admin.
--    SECURITY DEFINER so it reads the flag under RLS. Mirrors is_partner_member.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. RLS: partner writes are confined to 'pending'; admins moderate.
--
-- Postgres ORs permissive policies. An admin satisfies the admin branch; a
-- partner must satisfy is_partner_member AND status = 'pending'. So a partner
-- editing an already-approved product forces it back to 'pending' — an edited
-- product is re-reviewed, which is the behaviour we want.
--
-- SELECT/DELETE for partners are unchanged (is_partner_member); only INSERT and
-- UPDATE gain the status guard, plus two admin policies.
-- ---------------------------------------------------------------------------

-- INSERT: partners may only create pending rows.
drop policy if exists "partner members can insert products" on public.partner_products;
create policy "partner members can insert products"
  on public.partner_products for insert to public
  with check (public.is_partner_member(partner_id) and status = 'pending');

-- UPDATE: partners may edit their own rows but cannot self-approve.
drop policy if exists "partner members can update products" on public.partner_products;
create policy "partner members can update products"
  on public.partner_products for update to public
  using (public.is_partner_member(partner_id))
  with check (public.is_partner_member(partner_id) and status = 'pending');

-- Admins: read every product and set any status (the review action).
create policy "admins can read all partner products"
  on public.partner_products for select to public
  using (public.is_admin());

create policy "admins can update partner products"
  on public.partner_products for update to public
  using (public.is_admin())
  with check (public.is_admin());

commit;

notify pgrst, 'reload schema';
