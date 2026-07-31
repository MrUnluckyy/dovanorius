-- Internal admin flag that gates /admin (distinct from partner_users membership).
-- Grant it per-environment, e.g.:
--   update public.profiles set is_admin = true
--   where id in (select id from auth.users where lower(email) = '<owner-email>');
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Engagement by category (mirror of the merchant/brand funnels).
create or replace view public.inspo_type_funnel as
select
  coalesce(product_type, '(unknown)') as product_type,
  count(*) filter (where event_type = 'open')      as opens,
  count(*) filter (where event_type = 'save')      as saves,
  count(*) filter (where event_type = 'click_out') as clicks
from public.inspo_events
group by 1
order by clicks desc;

-- Catalog size per merchant (usable, gift-worthy feed) — the baseline the admin
-- dashboard compares engagement share against.
create or replace view public.inspo_catalog_by_merchant as
select merchant_name, count(*) as catalog_n
from public.inspo_products
where in_stock and image_url is not null and deep_link is not null and price >= 10
group by merchant_name;
