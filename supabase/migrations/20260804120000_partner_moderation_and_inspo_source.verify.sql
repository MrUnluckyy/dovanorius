-- Verification for 20260804120000_partner_moderation_and_inspo_source.sql
-- Run AFTER applying. Every row should report PASS.

-- 1. Schema: new columns exist.
select 'inspo_products.source added' as check,
       case when count(*) = 1 then 'PASS' else 'FAIL' end as result
from information_schema.columns
where table_schema = 'public' and table_name = 'inspo_products' and column_name = 'source'

union all
select 'inspo_products.partner_id added',
       case when count(*) = 1 then 'PASS' else 'FAIL' end
from information_schema.columns
where table_schema = 'public' and table_name = 'inspo_products' and column_name = 'partner_id'

union all
select 'partner_products moderation columns added (4)',
       case when count(*) = 4 then 'PASS' else 'FAIL (' || count(*) || '/4)' end
from information_schema.columns
where table_schema = 'public' and table_name = 'partner_products'
  and column_name in ('status', 'reviewed_at', 'reviewed_by', 'rejection_reason')

union all
select 'existing affiliate rows tagged source=affiliate',
       case when count(*) = 0 then 'PASS' else 'FAIL (' || count(*) || ' untagged)' end
from public.inspo_products where source is distinct from 'affiliate' and partner_id is null

union all
select 'is_admin() function exists',
       case when count(*) = 1 then 'PASS' else 'FAIL' end
from pg_proc where proname = 'is_admin' and pronamespace = 'public'::regnamespace

union all
select 'partner_products status-guard policies present (4)',
       case when count(*) = 4 then 'PASS' else 'FAIL (' || count(*) || '/4)' end
from pg_policies
where schemaname = 'public' and tablename = 'partner_products'
  and policyname in (
    'partner members can insert products',
    'partner members can update products',
    'admins can read all partner products',
    'admins can update partner products'
  );

-- 2. Behavioural spot-check (optional, run as a real partner member):
--    - INSERT with status = 'approved' should be rejected by RLS.
--    - UPDATE setting status = 'approved' should be rejected by RLS.
--    - Same actions as an is_admin profile should succeed.
