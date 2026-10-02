-- Repeat this event: start next year's edition of a finished event, shared by
-- the website and noriuto-app.
--
-- This used to live only in the website's server action
-- (app/actions/events/repeat.ts), which the app can't call. Both clients now
-- call these two functions, so "finished", the bumped name, the suggested date,
-- who gets invited and the duplicate guard can't drift apart.
--
--   ss_repeat_preview(event)            what repeating would do; writes nothing
--   ss_repeat_event(event, name, date)  does it, in one transaction
--
-- Changes from the server action:
-- - Draw rules are copied with their direction (ss_exclusions.mutual). The
--   action copied a and b only, so one-way rules came back two-way.
-- - The source event row is locked while repeating, so two taps can't both
--   pass the 2-minute duplicate check and create twins.

-- Shared plan: everything the preview shows and the repeat uses.
create or replace function public.ss_repeat_plan(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_uid   uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Vilnius')::date;
  v_max   date := (v_today + interval '10 years')::date;
  v_src   ss_events%rowtype;
  v_year  int;
  v_name  text;
  v_next  date;
  v_last  int;
  v_ids   uuid[];
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_src from ss_events where id = p_event_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not is_event_admin(v_src.id) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  -- Over: drawn and its date has passed (Vilnius), or archived.
  if not (
    v_src.status = 'archived'
    or (v_src.status = 'drawn' and v_src.event_date is not null and v_src.event_date < v_today)
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_finished');
  end if;

  -- "Kalėdos 2026" -> "Kalėdos 2027"; a name without a year gains one.
  v_year := extract(year from coalesce(v_src.event_date, (v_src.created_at at time zone 'Europe/Vilnius')::date))::int;
  if v_src.name ~ '\m(19|20)\d{2}\M' then
    v_name := regexp_replace(
      v_src.name,
      '\m(19|20)\d{2}\M',
      ((substring(v_src.name from '\m((?:19|20)\d{2})\M'))::int + 1)::text
    );
  else
    v_name := btrim(v_src.name) || ' ' || (v_year + 1);
  end if;

  -- Same day next year (29 Feb -> 28 Feb), kept within today .. today + 10y.
  if v_src.event_date is not null then
    v_last := extract(day from (make_date(extract(year from v_src.event_date)::int + 1,
                                          extract(month from v_src.event_date)::int, 1)
                                + interval '1 month - 1 day'))::int;
    v_next := make_date(extract(year from v_src.event_date)::int + 1,
                        extract(month from v_src.event_date)::int,
                        least(extract(day from v_src.event_date)::int, v_last));
    v_next := greatest(v_today, least(v_next, v_max));
  end if;

  -- Everyone who took part, minus the caller (the new event's owner), and only
  -- people with a profile (ss_invites.to_user references profiles).
  select coalesce(array_agg(m.user_id), '{}')
    into v_ids
    from ss_members m
   where m.event_id = v_src.id
     and m.is_confirmed
     and m.user_id <> v_uid
     and exists (select 1 from profiles p where p.id = m.user_id);

  return jsonb_build_object(
    'ok', true,
    'name', v_name,
    'suggested_date', v_next,
    'invitees', coalesce(array_length(v_ids, 1), 0),
    'invitee_ids', to_jsonb(v_ids)
  );
end
$function$;

revoke all on function public.ss_repeat_plan(uuid) from public, anon, authenticated;

-- For the confirm sheet: the new name, the suggested date, how many get invited.
create or replace function public.ss_repeat_preview(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  select ss_repeat_plan(p_event_id) - 'invitee_ids';
$function$;

comment on function public.ss_repeat_preview(uuid) is
  'Repeat this event, preview: {ok, name, suggested_date, invitees} or {ok:false, error}. Writes nothing.';

create or replace function public.ss_repeat_event(p_event_id uuid, p_name text, p_event_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid     uuid := auth.uid();
  v_today   date := (now() at time zone 'Europe/Vilnius')::date;
  v_name    text := left(btrim(coalesce(p_name, '')), 120);
  v_plan    jsonb;
  v_src     ss_events%rowtype;
  v_recent  ss_events%rowtype;
  v_new_id  uuid;
  v_slug    text;
  v_invited int := 0;
begin
  if v_name = '' then
    return jsonb_build_object('ok', false, 'error', 'name_required');
  end if;
  if p_event_date is null then
    return jsonb_build_object('ok', false, 'error', 'date_required');
  end if;
  if p_event_date < v_today then
    return jsonb_build_object('ok', false, 'error', 'date_in_past');
  end if;
  if p_event_date > (v_today + interval '10 years')::date then
    return jsonb_build_object('ok', false, 'error', 'date_too_far');
  end if;

  -- One repeat at a time per event: the duplicate check below must see a
  -- concurrent request's new event, not race it.
  select * into v_src from ss_events where id = p_event_id for update;

  v_plan := ss_repeat_plan(p_event_id);
  if not (v_plan->>'ok')::boolean then
    return v_plan;
  end if;

  -- A second request for the same repeat (double tap, retry after a slow
  -- network) returns the event the first one made instead of a twin.
  select * into v_recent
    from ss_events
   where previous_event_id = v_src.id
     and owner_id = v_uid
     and created_at >= now() - interval '2 minutes'
   order by created_at desc
   limit 1;
  if found then
    return jsonb_build_object('ok', true, 'event_id', v_recent.id, 'slug', v_recent.slug, 'invited', 0);
  end if;

  v_slug := trim(both '-' from regexp_replace(lower(nr_unaccent(v_name)), '[^a-z0-9]+', '-', 'g'));
  v_slug := coalesce(nullif(v_slug, ''), 'renginys') || '-' || substr(md5(random()::text), 1, 6);

  -- The owner becomes a member through ss_add_owner_as_member.
  insert into ss_events (slug, owner_id, name, type, budget, currency, notes, event_date,
                         status, previous_event_id, avoid_previous_match)
  values (v_slug, v_uid, v_name, v_src.type, v_src.budget, coalesce(v_src.currency, 'EUR'),
          v_src.notes, p_event_date, 'open', v_src.id, true)
  returning id into v_new_id;

  -- Draw rules carry over, direction included: the couples are still couples.
  insert into ss_exclusions (event_id, a, b, mutual)
  select v_new_id, e.a, e.b, e.mutual
    from ss_exclusions e
   where e.event_id = v_src.id;

  -- Invite everyone else again; the ss_invites trigger notifies (and pushes).
  insert into ss_invites (event_id, from_user, to_user, status)
  select v_new_id, v_uid, x.id::uuid, 'pending'
    from jsonb_array_elements_text(v_plan->'invitee_ids') as x(id)
  on conflict (event_id, to_user) do update set status = 'pending';
  get diagnostics v_invited = row_count;

  return jsonb_build_object('ok', true, 'event_id', v_new_id, 'slug', v_slug, 'invited', v_invited);
end
$function$;

comment on function public.ss_repeat_event(uuid, text, date) is
  'Repeat this event: creates next year''s edition of a finished event (organisers only), copies draw rules with direction, invites the participants. Idempotent for 2 minutes. {ok, event_id, slug, invited} or {ok:false, error}.';

revoke all on function public.ss_repeat_preview(uuid) from public, anon;
revoke all on function public.ss_repeat_event(uuid, text, date) from public, anon;
grant execute on function public.ss_repeat_preview(uuid) to authenticated;
grant execute on function public.ss_repeat_event(uuid, text, date) to authenticated;
