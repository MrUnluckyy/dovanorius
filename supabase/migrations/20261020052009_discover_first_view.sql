-- Discover first view (T2 of dev-issue-discover-premium, sections 4.1-4.5).
--
-- Additive only: one nullable profile column (plus its column grant) and one
-- read-only function.

-- Who the visitor last browsed for, preselected on their next visit. Keys are
-- the recipient tiles and chips in lib/discover/recipients.ts.
alter table public.profiles
  add column if not exists last_recipient text
  check (last_recipient is null or last_recipient in (
    'self', 'woman', 'man', 'couple', 'home', 'kid', 'teen', 'baby',
    'partner', 'mom', 'friend'
  ));

-- profiles has column-level UPDATE grants since 20261009_lock_profile_entitlements
-- (noriuto-app), so a new client-writable column needs its own grant.
-- Anonymous guests use the authenticated role too.
grant update (last_recipient) on public.profiles to authenticated;

/**
 * The caller's own top product types from discover engagement, for state 3's
 * "Tavo kategorijos". inspo_events has no client read access, so this returns
 * only the caller's aggregate counts and nothing else. Saves count double.
 */
create or replace function public.discover_my_categories(p_limit int default 8)
returns table (product_type text, weight numeric)
language sql
stable
security definer
set search_path = public
as $$
  select e.product_type,
         sum(case when e.event_type = 'save' then 2 else 1 end)::numeric
    from inspo_events e
   where auth.uid() is not null
     and e.user_id = auth.uid()
     and e.event_type in ('open', 'save', 'click_out')
     and e.product_type is not null
     and e.product_type <> 'other'
     and e.created_at > now() - interval '90 days'
   group by 1
   order by 2 desc, 1
   limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke all on function public.discover_my_categories(int) from public;
grant execute on function public.discover_my_categories(int) to anon, authenticated;
