-- One draw engine for web and noriuto-app.
--
-- The draw used to run in each client: the web's runDraw (a server action)
-- shuffled in JS and then wrote ss_draws, ss_assignments and the status in
-- three separate requests, and the app had its own copy without the status
-- check. Two engines, two sets of rules, and a crash between the requests
-- could leave assignments written for an event still marked open.
--
-- Now:
--   ss_check_draw(event)  - can this event be drawn, and how well? (read-only)
--   ss_run_draw(event)    - draw, in one transaction, under a row lock.
-- Both call ss_draw_solve(), so the check and the draw can't disagree.
--
-- Rules
--   hard: nobody draws themselves; ss_exclusions pairs never draw each other
--         (both directions).
--   soft: with previous_event_id set and avoid_previous_match on, A does not
--         draw whoever A drew in that event. One direction, and only for
--         people in both events.
--   When only the soft rule makes the draw impossible, it is relaxed as
--   little as possible (fewest repeats) rather than refused.
--
-- Solver
--   Min-cost assignment (Hungarian, O(n^3)) over: forbidden = 10^12,
--   repeat of last year = 10^6, allowed = small random noise. One pass proves
--   impossibility, finds the fewest repeats, and gives a random-ish draw.
--   When a no-repeat draw exists, ss_run_draw first tries random shuffles
--   (rejection sampling), which picks uniformly among valid draws like the old
--   JS did; the assignment result is the fallback for tightly constrained
--   events.
--
--   "predictable" = exactly one valid draw, which every participant could work
--   out. A draw is the only one iff there is no alternating cycle: no ring of
--   people who could pass their recipients along. That is a cycle check on n
--   nodes, not a count of all draws.

-- ---------------------------------------------------------------------------
-- Columns

alter table public.ss_events
  add column if not exists previous_event_id uuid
    references public.ss_events(id) on delete set null,
  add column if not exists avoid_previous_match boolean not null default true;

alter table public.ss_draws
  add column if not exists relaxed jsonb;

comment on column public.ss_events.previous_event_id is
  'Last edition of this event (e.g. last year''s Secret Santa). With avoid_previous_match, nobody draws the person they drew there.';
comment on column public.ss_events.avoid_previous_match is
  'Soft rule: avoid repeating previous_event_id''s pairs. Relaxed (fewest repeats) when it makes the draw impossible.';
comment on column public.ss_draws.relaxed is
  'Null for a normal draw. {"repeats": n, "people": [giver ids]} when the avoid-previous rule had to be relaxed.';

-- The soft rule makes ss_check_draw read the linked event's assignments, which
-- are secret. Linking someone else's event would let an organiser probe them
-- (who "repeats"), so only an admin of the linked event may link it. No user
-- session (service role, migrations) is not checked.
create or replace function public.ss_events_guard_previous()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.previous_event_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.previous_event_id is not distinct from old.previous_event_id then
    return new;
  end if;
  if new.previous_event_id = new.id then
    raise exception 'previous_event_self' using errcode = '23514';
  end if;
  if auth.uid() is not null and not is_event_admin(new.previous_event_id) then
    raise exception 'previous_event_not_allowed' using errcode = '42501';
  end if;
  return new;
end
$function$;

drop trigger if exists ss_events_guard_previous on public.ss_events;
create trigger ss_events_guard_previous
  before insert or update of previous_event_id on public.ss_events
  for each row execute function public.ss_events_guard_previous();

-- ---------------------------------------------------------------------------
-- Solver (internal; not callable by clients)

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
  for r in select a, b from ss_exclusions where event_id = p_event_id loop
    ia := array_position(people, r.a);
    ib := array_position(people, r.b);
    -- An exclusion can name someone who has since left; ignore it then.
    if ia is not null and ib is not null and ia <> ib then
      allowed[(ia - 1) * n + ib] := false;
      allowed[(ib - 1) * n + ia] := false;
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
    -- group (connected through exclusions) bigger than half the members
    -- cannot all be given someone outside it.
    comp := array_fill(0, array[n]);
    for i in 1..n loop comp[i] := i; end loop;
    for r in select a, b from ss_exclusions where event_id = p_event_id loop
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

-- ---------------------------------------------------------------------------
-- Public API

create or replace function public.ss_check_draw(p_event_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $function$
declare
  res jsonb;
begin
  if auth.uid() is null or not is_event_admin(p_event_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  res := ss_draw_solve(p_event_id, false);
  -- The check never hands out pairs: it is a preview, not a draw.
  -- count (confirmed members in the draw) is always there, so a message can
  -- say "3 of 5 people"; min only with too_few.
  return jsonb_build_object(
    'status',  res->'status',
    'reason',  res->'reason',
    'people',  coalesce(res->'people', '[]'::jsonb),
    'repeats', coalesce(res->'repeats', '0'::jsonb),
    'count',   (select count(*) from ss_members m where m.event_id = p_event_id and m.is_confirmed)
  ) || case when res ? 'min' then jsonb_build_object('min', res->'min')
            else '{}'::jsonb end;
end
$function$;

comment on function public.ss_check_draw(uuid) is
  'Preview a draw without writing: {status: ok|predictable|relaxed|impossible, reason, people[], repeats, count, min?}. Event admins only. See 20261001120000.';

create or replace function public.ss_run_draw(p_event_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $function$
declare
  uid     uuid := auth.uid();
  ev      record;
  res     jsonb;
  draw_id uuid;
  cnt     integer;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  -- Permission before the lock: a non-organiser must not be able to take the
  -- row lock (and stall the real organiser's draw) just by calling this.
  -- The existence check is a plain read, so an unknown id is still not_found.
  if not exists (select 1 from ss_events where id = p_event_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not is_event_admin(p_event_id) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  -- Lock the event: two organisers pressing Draw at once get one draw.
  select id, status, type into ev from ss_events where id = p_event_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found'); -- deleted meanwhile
  end if;
  if ev.type not in ('secret_santa', 'name_draw') then
    return jsonb_build_object('ok', false, 'error', 'not_draw_type');
  end if;
  -- 'draft' counts: the app creates events without a status, so they keep the
  -- column default and must still be drawable.
  if ev.status not in ('draft', 'open', 'locked') then
    return jsonb_build_object('ok', false, 'error', 'wrong_status');
  end if;

  res := ss_draw_solve(p_event_id, true);
  if res->>'status' = 'impossible' then
    return jsonb_build_object('ok', false, 'error', res->>'reason',
                              'people', coalesce(res->'people', '[]'::jsonb));
  end if;

  -- Anyone still on an unanswered invitation is not in the draw. Retired only
  -- once the draw is certain, so a failed attempt doesn't cancel invitations.
  update ss_invites set status = 'revoked'
   where event_id = p_event_id and status = 'pending';

  -- Leftovers from an earlier draw whose status was reset by hand would
  -- collide with (event_id, giver).
  delete from ss_assignments where event_id = p_event_id;

  insert into ss_draws (event_id, created_by, attempts, relaxed)
  values (
    p_event_id, uid, (res->>'attempts')::int,
    case when res->>'status' = 'relaxed'
         then jsonb_build_object('repeats', res->'repeats', 'people', res->'people') end
  )
  returning id into draw_id;

  insert into ss_assignments (draw_id, event_id, giver, receiver)
  select draw_id, p_event_id, (x->>'giver')::uuid, (x->>'receiver')::uuid
    from jsonb_array_elements(res->'pairs') x;
  get diagnostics cnt = row_count;

  update ss_events set status = 'drawn' where id = p_event_id;

  return jsonb_build_object('ok', true, 'count', cnt,
                            'status', res->'status', 'repeats', res->'repeats');
end
$function$;

comment on function public.ss_run_draw(uuid) is
  'Draw names in one transaction: {ok, error?, count?, status?, repeats?}. Event admins only. See 20261001120000.';

revoke all on function public.ss_check_draw(uuid) from public, anon;
revoke all on function public.ss_run_draw(uuid) from public, anon;
grant execute on function public.ss_check_draw(uuid) to authenticated;
grant execute on function public.ss_run_draw(uuid) to authenticated;
