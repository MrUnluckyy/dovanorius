-- Collection ranking v1 (T0 of dev-issue-discover-premium, section 4.8).
--
-- /discover rendered every shelf in fixed sort_order, so the three kids shelves
-- (sort_order 1-3) led the page for everyone. Each visitor now gets the shelves
-- ranked, and the page shows the top few. One function for web and app.
--
-- Additive only: a config table and a function. Nothing existing changes.

-- Weights live here, not in code, so they can be tuned from the tracking data
-- without a deploy:  update discover_config set value = jsonb_set(...) ...
create table if not exists public.discover_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
-- Read only by the security definer function below; no API access at all.
alter table public.discover_config enable row level security;
revoke all on public.discover_config from anon, authenticated;

insert into public.discover_config (key, value) values (
  'collection_ranking',
  $json$
  {
    "top": 4,
    "weights": {
      "recipient": 100,
      "behaviour": 40,
      "prior": 15,
      "season": 10,
      "popular": 10
    },
    "behaviour_days": 60,
    "popular_days": 7,
    "sensitive_audiences": ["kid", "teen"],
    "sensitive_signal_types": ["toys"],
    "prior": {
      "female": ["beauty", "home", "kitchen", "accessory"],
      "male": ["tech", "tools", "sport", "kitchen"],
      "18-24": ["tech", "beauty", "accessory"],
      "25-34": ["home", "tech", "kitchen"],
      "35-44": ["home", "kitchen", "beauty"],
      "45-54": ["home", "kitchen", "garden"],
      "55+": ["home", "garden", "kitchen"]
    }
  }
  $json$::jsonb
) on conflict (key) do nothing;

/**
 * Ranks the inline shelves (theme + editorial personas) for the caller.
 *
 *   p_recipient  slug of a recipient persona the visitor tapped this session
 *   p_audience   'her' | 'him' | 'everyone' — the audience chips; a stated
 *                lens that overrides profile gender for the prior
 *
 * Signals, strongest first: explicit recipient choice, behaviour (opens and
 * saves by product_type), demographic prior (gender, age), season (editorial
 * shelves in their window), popularity (opens of the shelf's picks).
 *
 * The sensitive rule: a kids or teen shelf only counts as qualified with an
 * explicit kid/teen recipient choice or behaviour in a sensitive product type
 * (toys). Age and gender never qualify one. Unqualified sensitive shelves are
 * ranked after every general shelf, so they are still reachable under
 * "Visos kolekcijos" but never in the top slots.
 *
 * The last top slot is an exploration slot: a qualified shelf outside the top
 * that the visitor has not opened anything from, rotated daily per visitor, so
 * the ranking keeps learning instead of locking in its first guess.
 *
 * Returns every active shelf, ordered, with is_top marking the first screen.
 */
create or replace function public.discover_rank_collections(
  p_recipient text default null,
  p_audience text default null
)
returns table (
  persona_id uuid,
  slug text,
  rank int,
  is_top boolean,
  score numeric,
  reason text,
  reason_detail text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  cfg jsonb;
  w jsonb;
  v_top int;
  v_uid uuid := auth.uid();
  v_gender text;
  v_age_band text;
  v_dob date;
  v_rec_audience text;
  v_rec_types text[];
  v_prior text[] := '{}';
  v_sensitive_aud text[];
  v_sensitive_types text[];
begin
  select value into cfg from discover_config where key = 'collection_ranking';
  cfg := coalesce(cfg, '{}'::jsonb);
  w := coalesce(cfg->'weights', '{}'::jsonb);
  v_top := coalesce((cfg->>'top')::int, 4);
  v_sensitive_aud := array(select jsonb_array_elements_text(coalesce(cfg->'sensitive_audiences', '["kid","teen"]')));
  v_sensitive_types := array(select jsonb_array_elements_text(coalesce(cfg->'sensitive_signal_types', '["toys"]')));

  -- Who the visitor is (signed-in or anonymous guest; both have a profile).
  if v_uid is not null then
    select p.gender, p.date_of_birth into v_gender, v_dob
      from profiles p where p.id = v_uid;
  end if;
  -- The audience chips are a choice made here; they beat the profile field.
  if p_audience = 'her' then v_gender := 'female';
  elsif p_audience = 'him' then v_gender := 'male';
  end if;
  if v_dob is not null then
    v_age_band := case
      when age(v_dob) < interval '18 years' then null
      when age(v_dob) < interval '25 years' then '18-24'
      when age(v_dob) < interval '35 years' then '25-34'
      when age(v_dob) < interval '45 years' then '35-44'
      when age(v_dob) < interval '55 years' then '45-54'
      else '55+'
    end;
  end if;
  v_prior := array(
    select distinct t from (
      select jsonb_array_elements_text(coalesce(cfg->'prior'->v_gender, '[]')) as t
      union all
      select jsonb_array_elements_text(coalesce(cfg->'prior'->v_age_band, '[]'))
    ) x
  );

  -- An explicit recipient: its audience, and the categories it is made of.
  if p_recipient is not null then
    select gp.audience,
           array(select distinct ip.product_type
                   from persona_products pp
                   join inspo_products ip on ip.id = pp.product_id
                  where pp.persona_id = gp.id and ip.product_type <> 'other')
      into v_rec_audience, v_rec_types
      from gift_personas gp
     where gp.slug = p_recipient and gp.kind = 'recipient' and gp.is_active;
  end if;

  return query
  with shelves as (
    -- Same visibility as the gift_personas_read policy, which this function
    -- bypasses as security definer.
    select gp.id, gp.slug, gp.kind, gp.audience, gp.sort_order,
           gp.audience = any(v_sensitive_aud) as sensitive,
           array(select distinct ip.product_type
                   from persona_products pp
                   join inspo_products ip on ip.id = pp.product_id
                  where pp.persona_id = gp.id and ip.product_type <> 'other'
                    and ip.in_stock) as types
      from gift_personas gp
     where gp.kind in ('theme', 'editorial')
       and gp.is_active
       and (gp.starts_at is null or gp.starts_at <= now())
       and (gp.ends_at is null or gp.ends_at > now())
       -- PersonaShelf renders nothing below MIN_ITEMS (lib/discover/shelf-rules.ts)
       -- in-stock picks; such a shelf must not take a top slot.
       and (select count(*) from persona_products pp
              join inspo_products ip on ip.id = pp.product_id
             where pp.persona_id = gp.id and ip.in_stock) >= 4
  ),
  -- The visitor's own engagement by product type. Saves count double.
  mine as (
    select e.product_type as t,
           sum(case when e.event_type = 'save' then 2 else 1 end)::numeric as n
      from inspo_events e
     where v_uid is not null
       and e.user_id = v_uid
       and e.event_type in ('open', 'save', 'click_out')
       and e.product_type is not null and e.product_type <> 'other'
       and e.created_at > now() - make_interval(days => coalesce((cfg->>'behaviour_days')::int, 60))
     group by 1
  ),
  mine_total as (select coalesce(sum(n), 0) as total from mine),
  -- Shelves the visitor already opened something from: not "unseen".
  seen as (
    select distinct pp.persona_id
      from inspo_events e
      join persona_products pp on pp.product_id = e.product_id
     where v_uid is not null and e.user_id = v_uid and e.event_type = 'open'
  ),
  popular as (
    select pp.persona_id, count(*)::numeric as n
      from inspo_events e
      join persona_products pp on pp.product_id = e.product_id
     where e.event_type = 'open'
       and e.created_at > now() - make_interval(days => coalesce((cfg->>'popular_days')::int, 7))
     group by 1
  ),
  popular_max as (select greatest(max(n), 1) as m from popular),
  scored as (
    select s.*,
      -- Explicit choice: a kid/teen recipient lifts shelves of that audience;
      -- any recipient lifts shelves made of the same categories.
      case
        when v_rec_audience is null then 0
        when s.sensitive then (case when s.audience = v_rec_audience then 1 else 0 end)
        when v_rec_audience = any(v_sensitive_aud) then 0
        else coalesce(
          (select count(*)::numeric from unnest(s.types) t where t = any(v_rec_types))
            / nullif(cardinality(s.types), 0), 0)
      end as f_recipient,
      -- Share of the visitor's engagement that falls in this shelf's types.
      coalesce(
        (select sum(m.n) from mine m where m.t = any(s.types))
          / nullif((select total from mine_total), 0), 0) as f_behaviour,
      (select m.t from mine m where m.t = any(s.types) order by m.n desc, m.t limit 1) as top_type,
      exists (select 1 from mine m where m.t = any(s.types) and m.t = any(v_sensitive_types)) as sensitive_behaviour,
      case when s.sensitive then 0
           else coalesce(
             (select count(*)::numeric from unnest(s.types) t where t = any(v_prior))
               / nullif(cardinality(s.types), 0), 0)
      end as f_prior,
      case when s.kind = 'editorial' then 1 else 0 end as f_season,
      coalesce((select p.n from popular p where p.persona_id = s.id), 0)
        / (select m from popular_max) as f_popular,
      s.id in (select sn.persona_id from seen sn) as was_seen
    from shelves s
  ),
  totals as (
    select sc.*,
      (not sc.sensitive)
        or (sc.f_recipient > 0)
        or sc.sensitive_behaviour as qualified,
      sc.f_recipient * coalesce((w->>'recipient')::numeric, 100)
      -- Behaviour on a sensitive shelf only counts through sensitive types,
      -- so an adult who browses shoes does not unlock "Vaikai lauke".
      + (case when sc.sensitive and not sc.sensitive_behaviour then 0 else sc.f_behaviour end)
          * coalesce((w->>'behaviour')::numeric, 40)
      + sc.f_prior * coalesce((w->>'prior')::numeric, 15)
      + sc.f_season * coalesce((w->>'season')::numeric, 10)
      + sc.f_popular * coalesce((w->>'popular')::numeric, 10) as total
    from scored sc
  ),
  ordered as (
    select t.*,
      row_number() over (
        order by t.qualified desc, t.total desc, t.sort_order, t.slug
      )::int as base_rank
    from totals t
  ),
  -- Exploration: among qualified shelves below the first (top - 1), pick one
  -- the visitor has not opened from, rotated by day and visitor.
  explore as (
    select o.id
      from ordered o
     where o.qualified and o.base_rank >= v_top and not o.was_seen
     order by md5(o.id::text || coalesce(v_uid::text, 'anon') || current_date::text)
     limit 1
  ),
  final as (
    select o.*,
      (o.id in (select id from explore)) as is_explore,
      row_number() over (
        order by
          case
            when o.base_rank < v_top then 0
            when o.id in (select id from explore) then 1
            else 2
          end,
          o.base_rank
      )::int as final_rank
    from ordered o
  )
  select f.id, f.slug, f.final_rank,
         f.final_rank <= v_top and f.qualified,
         round(f.total, 2),
         case
           when f.is_explore and f.final_rank <= v_top then 'explore'
           when f.f_recipient > 0 then 'recipient'
           when f.f_behaviour > 0 and (not f.sensitive or f.sensitive_behaviour) then 'behaviour'
           when f.f_prior > 0 then 'prior'
           when f.f_season > 0 then 'season'
           when f.f_popular > 0 then 'popular'
         end,
         case
           when f.f_behaviour > 0 and (not f.sensitive or f.sensitive_behaviour) then f.top_type
         end
    from final f
   order by f.final_rank;
end;
$$;

revoke all on function public.discover_rank_collections(text, text) from public;
grant execute on function public.discover_rank_collections(text, text) to anon, authenticated;
