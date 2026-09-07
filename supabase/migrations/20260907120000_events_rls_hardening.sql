-- Events: make Row Level Security actually apply.
--
-- `ss_members`, `ss_invites`, `ss_draws` and `ss_exclusions` each carried a full
-- set of policies and had RLS switched OFF, so none of them were enforced. Any
-- signed-in user could read every event's roster, and — worse — insert
-- themselves into `ss_members` with role 'owner', which makes is_event_admin()
-- true, which is the key that opens `ss_assignments`. The Secret Santa result
-- for any event on the platform was one INSERT away from being readable.
--
-- Separately, `ss_assignments` DID have RLS on but carried two SELECT policies.
-- Policies are OR'd, so the legacy "Members read assignments" (any member of
-- the event) defeated the narrow "assignments_read_member" (your own row, or an
-- admin) sitting right next to it. Every participant could already read who
-- drew whom. That one is dropped here.
--
-- HOW TO RUN: paste into the Supabase SQL editor (idempotent).

begin;

-- ── 1. Policy helpers must bypass RLS ────────────────────────────────────────
-- is_event_admin() reads ss_members, and is itself used in ss_members policies.
-- With RLS enabled that is a self-referencing loop and Postgres aborts with
-- "infinite recursion detected in policy for relation ss_members". SECURITY
-- DEFINER runs the body as the table owner, which breaks the cycle. This is why
-- simply flipping RLS on without touching these functions would take the whole
-- events feature down.

create or replace function public.is_event_admin(e uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from ss_events ev
    where ev.id = e and ev.owner_id = auth.uid()
  ) or exists(
    select 1 from ss_members m
    where m.event_id = e and m.user_id = auth.uid() and m.role in ('owner','admin')
  );
$$;

create or replace function public.is_event_member(e uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from ss_events ev
    where ev.id = e and ev.owner_id = auth.uid()
  ) or exists(
    select 1 from ss_members m
    where m.event_id = e and m.user_id = auth.uid()
  );
$$;

comment on function public.is_event_member(uuid) is
  'True when the caller belongs to the event. SECURITY DEFINER so it can be used inside ss_members policies without recursion.';

-- ── 2. ss_members ────────────────────────────────────────────────────────────
-- Reading: a participant sees the whole roster of an event they belong to.
-- The old policy only matched your own row, which would have collapsed every
-- participant list (web lobby, mobile event screen, the ss_participants view)
-- to a single person the moment RLS started applying.
drop policy if exists members_read_member on public.ss_members;
drop policy if exists members_insert_admin on public.ss_members;
drop policy if exists members_insert_self on public.ss_members;
drop policy if exists members_update_self_or_admin on public.ss_members;

create policy members_select on public.ss_members
  for select using (user_id = auth.uid() or is_event_member(event_id));

-- Joining is not self-service: you may add yourself only against an invite that
-- names you, and only as a plain member. Without the role check an invitee
-- could insert themselves as 'owner' and inherit admin rights over an event
-- they were merely invited to. Link/e-mail joins do not come through here —
-- they go through accept_ss_join(), which is SECURITY DEFINER.
create policy members_insert on public.ss_members
  for insert with check (
    is_event_admin(event_id)
    or (
      user_id = auth.uid()
      and role = 'member'
      and exists (
        select 1 from ss_invites i
        where i.event_id = ss_members.event_id
          and i.to_user  = auth.uid()
          and i.status in ('pending','accepted')
      )
    )
  );

-- Same reasoning on update: you may edit your own wants/address, but you may
-- not promote yourself out of 'member'.
create policy members_update on public.ss_members
  for update
  using (user_id = auth.uid() or is_event_admin(event_id))
  with check (
    is_event_admin(event_id)
    or (user_id = auth.uid() and role = 'member')
  );

-- There was no DELETE policy at all, so leaving an event was impossible and the
-- mobile app's removeSSMember() would have started failing silently.
create policy members_delete on public.ss_members
  for delete using (user_id = auth.uid() or is_event_admin(event_id));

alter table public.ss_members enable row level security;

-- ── 3. ss_invites ────────────────────────────────────────────────────────────
-- The three existing policies are correct; they were just never applied.
-- Organisers additionally get a hard delete so a mis-typed invite can be
-- cleared rather than left as a 'revoked' tombstone in the roster.
drop policy if exists invites_delete_admin on public.ss_invites;
create policy invites_delete_admin on public.ss_invites
  for delete using (is_event_admin(event_id));

alter table public.ss_invites enable row level security;

-- ── 4. ss_draws / ss_exclusions ──────────────────────────────────────────────
-- Both already carry an admin-only ALL policy. Exclusions in particular are the
-- organiser's private notes about who cannot draw whom.
alter table public.ss_draws      enable row level security;
alter table public.ss_exclusions enable row level security;

-- ── 5. ss_assignments: one SELECT policy, not two ────────────────────────────
-- "Members read assignments" let any participant read every pairing in the
-- event. assignments_read_member (own row, or an organiser) is the intended
-- rule and survives alone. "Owner creates assignments" is dropped as a
-- duplicate of assignments_admin_insert.
drop policy if exists "Members read assignments"  on public.ss_assignments;
drop policy if exists "Owner creates assignments" on public.ss_assignments;

commit;
