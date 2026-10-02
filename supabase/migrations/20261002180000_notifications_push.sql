-- Push from the database, not from each client.
--
-- Pushes used to come from whichever client did the action: noriuto-app called
-- the send-push edge function after its own invite and draw, and the website
-- never pushed at all. So an invite or a draw made on the website never reached
-- anyone's phone, although the database already writes a notifications row for
-- both (ss_invite: 20261001100000, ss_drawn: 20261001110000).
--
-- Now every notifications insert of a pushable type pushes, whoever caused it.
-- The trigger posts straight to Expo's push API with pg_net, reading the
-- recipient's device_tokens itself, so it needs no edge function and no stored
-- key. Titles and data match what the app sent before, so its tap handling
-- (app/(tabs)/_layout.tsx: data.kind === 'ss_invite' → invites, data.eventId →
-- the event) keeps working.
--
-- Pushed: ss_invite, ss_drawn. Not pushed: ss_joined (written for the joiner
-- themself), reservation_reserved (a confirmation of your own action),
-- reservation_checkin (a gentle in-app nudge), broadcasts (user_id null).
--
-- Ships with noriuto-app removing its own pushes for invites and draws, and
-- send-push becoming a no-op, so older app builds still calling it don't push
-- a second time.
--
-- pg_net is asynchronous: the request is queued and sent after commit, so a
-- slow or failing Expo never slows or fails the insert. Any error building the
-- request is swallowed for the same reason; the in-app notification stands.

create or replace function public.notifications_send_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event text := nullif(new.payload->>'event_name', '');
  v_title text;
  v_body  text;
  v_data  jsonb;
  v_msgs  jsonb;
begin
  if new.user_id is null then
    return new;
  end if;

  case new.type
    when 'ss_invite' then
      v_title := 'Pakvietimas';
      v_body  := coalesce('Tave pakvietė į „' || v_event || '“', 'Gavai naują pakvietimą');
      v_data  := jsonb_build_object('kind', 'ss_invite', 'eventId', new.payload->>'event_id');
    when 'ss_drawn' then
      v_title := 'Vardai ištraukti!';
      v_body  := coalesce('Patikrink savo žaidėją renginyje „' || v_event || '“', 'Vardai ištraukti!');
      v_data  := jsonb_build_object('kind', 'ss_drawn', 'eventId', new.payload->>'event_id');
    else
      return new;
  end case;

  select jsonb_agg(jsonb_build_object(
           'to',    t.expo_push_token,
           'title', v_title,
           'body',  v_body,
           'data',  v_data,
           'sound', 'default'
         ))
    into v_msgs
    from device_tokens t
   where t.user_id = new.user_id;

  if v_msgs is null then
    return new;
  end if;

  perform net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    body    := v_msgs,
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return new;
exception when others then
  raise warning 'notifications_send_push failed for %: %', new.id, sqlerrm;
  return new;
end
$function$;

comment on function public.notifications_send_push() is
  'Trigger: pushes ss_invite and ss_drawn notifications to the recipient''s Expo device tokens via pg_net.';

drop trigger if exists notifications_send_push on public.notifications;
create trigger notifications_send_push
  after insert on public.notifications
  for each row
  execute function public.notifications_send_push();
