-- Verification for 20260804130000_fix_permissive_rls_boards_items.sql
-- Run AFTER applying. Every row should report PASS.

set local role anon;

select 'private boards hidden from anon' as check,
       case when count(*) = 0 then 'PASS' else 'FAIL (' || count(*) || ' visible)' end as result
from boards where is_public = false
union all
select 'public boards still visible to anon',
       case when count(*) > 0 then 'PASS' else 'FAIL (none visible)' end
from boards where is_public = true
union all
select 'items on private boards hidden from anon',
       case when count(*) = 0 then 'PASS' else 'FAIL (' || count(*) || ' visible)' end
from items i join boards b on b.id = i.board_id where b.is_public = false
union all
select 'items on public boards still visible to anon',
       case when count(*) > 0 then 'PASS' else 'FAIL (none visible)' end
from items i join boards b on b.id = i.board_id where b.is_public = true;

reset role;

-- No blanket USING(true) policies remain on boards/items.
select 'no blanket true read policies remain' as check,
       case when count(*) = 0 then 'PASS' else 'FAIL (' || count(*) || ')' end as result
from pg_policies
where schemaname = 'public' and tablename in ('boards','items')
  and cmd = 'SELECT' and qual = 'true';
