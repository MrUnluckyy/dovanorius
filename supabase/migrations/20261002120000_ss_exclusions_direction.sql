-- Draw rules get a direction.
--
-- Until now every ss_exclusions row meant "a and b never draw each other",
-- which covers partners but not "Ona drew Rūta last year, so Ona shouldn't
-- draw her again" (Rūta drawing Ona is fine). A rule can now be one-way:
--   mutual = true  (default): neither draws the other. Every existing row.
--   mutual = false          : a must not draw b; b may draw a.
-- Rows are stored so that a mutual rule is one row with a < b, and a one-way
-- rule has a = giver, b = receiver. The web's setPairRule action keeps it so.
--
-- The draw engine (ss_draw_solve) and the ss_assignments exclusion trigger
-- read the direction. household_too_big is now computed from two-way rules
-- only: the Hall's-theorem argument behind it needs symmetric rules.

alter table public.ss_exclusions
  add column if not exists mutual boolean not null default true;

comment on column public.ss_exclusions.mutual is
  'true: a and b never draw each other. false: a must not draw b (b may draw a).';

create or replace function public.ss_draw_solve(p_event_id uuid, p_randomize boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $function$
declare
  c_forbid  constant bigint := 1000000000000;     -- 10^12
  c_repeat  constant bigint := 1000000;           -- 10^6 (> n * max noise)
  c_big     constant bigint := 4000000000000000000;

  v_type    text;
  v_prev_ev uuid;
  v_avoid   boolean;
  v_min     integer;

  people    uuid[];
  n         integer;
  allowed   boolean[];   -- hard rules, flattened (i-1)*n + j
  prev      integer[];   -- index of whom i drew last time, 0 = none
  cost      bigint[];
  r         record;
  i integer; j integer; k integer;
  ia integer; ib integer;

  -- Hungarian state (0-based arrays)
  u bigint[]; v bigint[]; minv bigint[];
  p integer[]; way integer[]; used boolean[];
  i0 integer; j0 integer; j1 integer; delta bigint; cur bigint;

  match     integer[];   -- match[i] = receiver index for giver i
  total     bigint := 0;
  repeats   integer := 0;
  rep_people uuid[] := '{}';
  attempts  integer := 0;
  perm      integer[];
  ok        boolean;
  tmp       integer;

  -- uniqueness (alternating cycle) check
  owner_of  integer[];   -- owner_of[j] = giver currently receiving... giving to j
  outdeg    integer[];
  removed   boolean[];
  queue     integer[];
  qh integer; qt integer;
  left_n    integer;

  -- components for household_too_big
  comp      integer[];
  old_label integer; new_label integer;
  csize     integer;
  status    text;
  stuck     uuid[] := '{}';
begin
  select type, previous_event_id, avoid_previous_match
    into v_type, v_prev_ev, v_avoid
    from ss_events where id = p_event_id;
  if not found then
    return jsonb_build_object('status', 'impossible', 'reason', 'not_found', 'people', '[]'::jsonb);
  end if;

  v_min := case v_type when 'secret_santa' then 3 else 2 end;

  select coalesce(array_agg(m.user_id order by m.user_id), '{}')
    into people
    from ss_members m
   where m.event_id = p_event_id and m.is_confirmed;
  n := coalesce(array_length(people, 1), 0);

  if n < v_min then
    return jsonb_build_object('status', 'impossible', 'reason', 'too_few', 'people', '[]'::jsonb,
                              'min', v_min, 'count', n);
  end if;

  -- Hard rules.
  allowed := array_fill(true, array[n * n]);
  for i in 1..n loop
    allowed[(i - 1) * n + i] := false;
  end loop;
  -- a must not draw b; with mutual, b must not draw a either.
  for r in select a, b, mutual from ss_exclusions where event_id = p_event_id loop
    ia := array_position(people, r.a);
    ib := array_position(people, r.b);
    -- An exclusion can name someone who has since left; ignore it then.
    if ia is not null and ib is not null and ia <> ib then
      allowed[(ia - 1) * n + ib] := false;
      if r.mutual then
        allowed[(ib - 1) * n + ia] := false;
      end if;
    end if;
  end loop;

  -- Soft rule: last edition's pairs, one direction, people in both events.
  prev := array_fill(0, array[n]);
  if v_prev_ev is not null and v_avoid then
    for r in select giver, receiver from ss_assignments where event_id = v_prev_ev loop
      ia := array_position(people, r.giver);
      ib := array_position(people, r.receiver);
      if ia is not null and ib is not null then
        prev[ia] := ib;
      end if;
    end loop;
  end if;

  -- Someone with nobody to draw: say who, before anything else.
  for i in 1..n loop
    ok := false;
    for j in 1..n loop
      if allowed[(i - 1) * n + j] then ok := true; exit; end if;
    end loop;
    if not ok then stuck := stuck || people[i]; end if;
  end loop;
  if cardinality(stuck) > 0 then
    return jsonb_build_object('status', 'impossible', 'reason', 'no_recipient', 'people', to_jsonb(stuck));
  end if;

  -- Cost matrix.
  cost := array_fill(0::bigint, array[n * n]);
  for i in 1..n loop
    for j in 1..n loop
      k := (i - 1) * n + j;
      if not allowed[k] then
        cost[k] := c_forbid;
      else
        cost[k] := case when prev[i] = j then c_repeat else 0 end
                 + case when p_randomize then floor(random() * 1000)::bigint else 0 end;
      end if;
    end loop;
  end loop;

  -- Hungarian algorithm (e-maxx), rows = givers, cols = receivers.
  u := array_fill(0::bigint, array[n + 1], array[0]);
  v := array_fill(0::bigint, array[n + 1], array[0]);
  p := array_fill(0, array[n + 1], array[0]);
  way := array_fill(0, array[n + 1], array[0]);
  for i in 1..n loop
    p[0] := i;
    j0 := 0;
    minv := array_fill(c_big, array[n + 1], array[0]);
    used := array_fill(false, array[n + 1], array[0]);
    loop
      used[j0] := true;
      i0 := p[j0];
      delta := c_big;
      j1 := 0;
      for j in 1..n loop
        if not used[j] then
          cur := cost[(i0 - 1) * n + j] - u[i0] - v[j];
          if cur < minv[j] then minv[j] := cur; way[j] := j0; end if;
          if minv[j] < delta then delta := minv[j]; j1 := j; end if;
        end if;
      end loop;
      for j in 0..n loop
        if used[j] then
          u[p[j]] := u[p[j]] + delta;
          v[j] := v[j] - delta;
        else
          minv[j] := minv[j] - delta;
        end if;
      end loop;
      j0 := j1;
      exit when p[j0] = 0;
    end loop;
    loop
      j1 := way[j0];
      p[j0] := p[j1];
      j0 := j1;
      exit when j0 = 0;
    end loop;
  end loop;

  match := array_fill(0, array[n]);
  for j in 1..n loop
    match[p[j]] := j;
  end loop;
  for i in 1..n loop
    total := total + cost[(i - 1) * n + match[i]];
  end loop;

  if total >= c_forbid then
    -- Impossible under the hard rules. Best explanation first: an exclusion
    -- group (connected through two-way exclusions) bigger than half the
    -- members cannot all be given someone outside it. One-way rules don't
    -- form such groups; an impossibility they cause is reported as
    -- impossible_other.
    comp := array_fill(0, array[n]);
    for i in 1..n loop comp[i] := i; end loop;
    for r in select a, b from ss_exclusions where event_id = p_event_id and mutual loop
      ia := array_position(people, r.a);
      ib := array_position(people, r.b);
      if ia is not null and ib is not null and comp[ia] <> comp[ib] then
        old_label := comp[ib]; new_label := comp[ia];
        for k in 1..n loop
          if comp[k] = old_label then comp[k] := new_label; end if;
        end loop;
      end if;
    end loop;
    for k in 1..n loop
      csize := 0;
      for i in 1..n loop if comp[i] = k then csize := csize + 1; end if; end loop;
      if csize * 2 > n then
        select coalesce(array_agg(people[g] order by g), '{}') into stuck
          from generate_series(1, n) g where comp[g] = k;
        return jsonb_build_object('status', 'impossible', 'reason', 'household_too_big',
                                  'people', to_jsonb(stuck));
      end if;
    end loop;
    return jsonb_build_object('status', 'impossible', 'reason', 'impossible_other', 'people', '[]'::jsonb);
  end if;

  for i in 1..n loop
    if prev[i] > 0 and match[i] = prev[i] then
      repeats := repeats + 1;
      rep_people := rep_people || people[i];
    end if;
  end loop;

  if repeats > 0 then
    status := 'relaxed';
  else
    -- From here "allowed" means hard and soft together: a draw with no
    -- repeats exists, so the soft rule is honoured fully.
    for i in 1..n loop
      if prev[i] > 0 then allowed[(i - 1) * n + prev[i]] := false; end if;
    end loop;

    -- Uniform pick: rejection sampling over random permutations.
    if p_randomize then
      -- (A FOR loop declares its own counter, so attempts is kept by hand.)
      for tmp in 1..300 loop
        attempts := tmp;
        perm := array(select g from generate_series(1, n) g order by random());
        ok := true;
        for i in 1..n loop
          if not allowed[(i - 1) * n + perm[i]] then ok := false; exit; end if;
        end loop;
        if ok then match := perm; exit; end if;
      end loop;
    end if;

    -- Is this the only valid draw? Graph on givers: i -> k when i may give
    -- to k's current recipient. Another draw exists iff that graph has a
    -- cycle. Peel off nodes that lead nowhere; anything left is a cycle.
    owner_of := array_fill(0, array[n]);
    for i in 1..n loop owner_of[match[i]] := i; end loop;
    outdeg := array_fill(0, array[n]);
    removed := array_fill(false, array[n]);
    for i in 1..n loop
      for k in 1..n loop
        if k <> i and allowed[(i - 1) * n + match[k]] then outdeg[i] := outdeg[i] + 1; end if;
      end loop;
    end loop;
    queue := '{}';
    for i in 1..n loop if outdeg[i] = 0 then queue := queue || i; end if; end loop;
    qh := 1; left_n := n;
    while qh <= coalesce(cardinality(queue), 0) loop
      k := queue[qh]; qh := qh + 1;
      if removed[k] then continue; end if;
      removed[k] := true; left_n := left_n - 1;
      for i in 1..n loop
        if not removed[i] and i <> k and allowed[(i - 1) * n + match[k]] then
          outdeg[i] := outdeg[i] - 1;
          if outdeg[i] = 0 then queue := queue || i; end if;
        end if;
      end loop;
    end loop;

    status := case when left_n = 0 then 'predictable' else 'ok' end;
  end if;

  return jsonb_build_object(
    'status',   status,
    'reason',   null,
    'people',   case when status = 'relaxed' then to_jsonb(rep_people)
                     when status = 'predictable' then to_jsonb(people)
                     else '[]'::jsonb end,
    'repeats',  repeats,
    'attempts', attempts,
    'pairs',    (select jsonb_agg(jsonb_build_object('giver', people[g], 'receiver', people[match[g]]))
                   from generate_series(1, n) g)
  );
end
$function$;

revoke all on function public.ss_draw_solve(uuid, boolean) from public, anon, authenticated;

create or replace function public.ss_assignments_respect_exclusions()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if exists (
    select 1
      from ss_exclusions x
     where x.event_id = new.event_id
       and (   (x.a = new.giver    and x.b = new.receiver)
            or (x.mutual and x.a = new.receiver and x.b = new.giver))
  ) then
    raise exception 'excluded_pair' using errcode = '23514';
  end if;
  return new;
end
$function$;
