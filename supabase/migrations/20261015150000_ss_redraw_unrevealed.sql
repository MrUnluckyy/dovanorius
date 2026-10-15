-- Redraw — but only while nobody has seen who they drew.
--
-- A draw used to be final the moment it ran, so an organiser who forgot a rule
-- ("couples shouldn't draw each other") had one way out: make a new event. On
-- 2026-10-13 one group did that twice in an afternoon, leaving every member
-- three drawn events with three different people.
--
-- The line is `revealed`. Until anyone — organiser included — has opened their
-- result, a redraw changes nothing anyone knows, so it's safe. After that it
-- would turn the game into "draw until everyone likes it", so it's refused.
--
-- Why not just reset the status and call ss_run_draw: the ss_drawn
-- notification trigger fires on every change TO 'drawn', so members would get
-- "names drawn" twice. Here the status never moves; only the pairs do. The
-- notification they already have still says the right thing.

create or replace function public.ss_redraw(p_event_id uuid)
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
  if not exists (select 1 from ss_events where id = p_event_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not is_event_admin(p_event_id) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  select id, status, type into ev from ss_events where id = p_event_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if ev.type not in ('secret_santa', 'name_draw') then
    return jsonb_build_object('ok', false, 'error', 'not_draw_type');
  end if;
  if ev.status <> 'drawn' then
    return jsonb_build_object('ok', false, 'error', 'wrong_status');
  end if;

  -- Lock the assignments before looking at them: ss_mark_revealed waits here
  -- rather than marking a row we are about to replace, so "nobody has looked"
  -- can't change between this check and the delete.
  perform 1 from ss_assignments where event_id = p_event_id for update;
  if exists (select 1 from ss_assignments where event_id = p_event_id and revealed) then
    return jsonb_build_object('ok', false, 'error', 'already_revealed');
  end if;

  res := ss_draw_solve(p_event_id, true);
  if res->>'status' = 'impossible' then
    return jsonb_build_object('ok', false, 'error', res->>'reason',
                              'people', coalesce(res->'people', '[]'::jsonb));
  end if;

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

  return jsonb_build_object('ok', true, 'count', cnt,
                            'status', res->'status', 'repeats', res->'repeats');
end
$function$;

comment on function public.ss_redraw(uuid) is
  'Redraw a drawn event while no assignment is revealed: {ok, error?, count?}. error already_revealed once anyone has looked. Status stays drawn, so no second ss_drawn notification. See 20261015150000.';

revoke all on function public.ss_redraw(uuid) from public, anon;
grant execute on function public.ss_redraw(uuid) to authenticated;

notify pgrst, 'reload schema';
