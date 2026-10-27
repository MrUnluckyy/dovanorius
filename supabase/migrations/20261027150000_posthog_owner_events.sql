-- Owner-side analytics, sent from the database.
--
-- "Someone reserved one of my wishes" and "someone opened my list" happen to
-- the board owner, but on somebody else's device — in the web, the iOS app or
-- the Android app. Captured client-side, each of those would need the same
-- code in every client, and any one missing would leave the funnel silently
-- short. Here they fire once, from the row change itself, whoever made it.
--
-- Events go to PostHog's capture API through pg_net (async: nothing waits on
-- PostHog, and a failed post never blocks the reservation). distinct_id is the
-- owner's user id, the same id both clients identify with, so it lands on the
-- owner's existing person.
--
-- The project key lives in Vault (name 'posthog_project_key'), not here; with
-- no key set these functions do nothing. Optional 'posthog_host' overrides the
-- EU ingestion host.

create or replace function public.posthog_capture(
  p_event text,
  p_distinct_id uuid,
  p_props jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key  text;
  v_host text;
begin
  if p_distinct_id is null then
    return;
  end if;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'posthog_project_key';
  if v_key is null then
    return;
  end if;

  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'posthog_host'),
    'https://eu.i.posthog.com'
  ) into v_host;

  perform net.http_post(
    url     := v_host || '/i/v0/e/',
    body    := jsonb_build_object(
      'api_key',     v_key,
      'event',       p_event,
      'distinct_id', p_distinct_id::text,
      'properties',  coalesce(p_props, '{}'::jsonb) || jsonb_build_object('$lib', 'postgres')
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
exception when others then
  -- Analytics must never be the reason a reservation or a board open fails.
  raise warning 'posthog_capture % failed: %', p_event, sqlerrm;
end;
$$;

-- Only the triggers below call it; no client may post events as someone else.
revoke all on function public.posthog_capture(text, uuid, jsonb) from public, anon, authenticated;

-- ── received_reservation ────────────────────────────────────────────────────
-- A wish went to 'reserved', by anyone but the owner. No reserver identity is
-- sent: reservations are hidden from owners in the product, and the analytics
-- event must not be a way round that.
create or replace function public.items_capture_received_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_guest boolean;
begin
  if new.status <> 'reserved' or old.status = 'reserved' then
    return new;
  end if;

  select owner_id into v_owner from public.boards where id = new.board_id;
  if v_owner is null or new.reserved_by is not distinct from v_owner then
    return new;
  end if;

  select u.is_anonymous into v_guest from auth.users u where u.id = new.reserved_by;

  perform public.posthog_capture(
    'received_reservation',
    v_owner,
    jsonb_build_object(
      'board_id',          new.board_id,
      'item_id',           new.id,
      'reserver_is_guest', coalesce(v_guest, false)
    )
  );
  return new;
end;
$$;

drop trigger if exists items_capture_received_reservation on public.items;
create trigger items_capture_received_reservation
  after update of status on public.items
  for each row execute function public.items_capture_received_reservation();

-- ── received_view ───────────────────────────────────────────────────────────
-- board_opens holds one row per visitor per board (record_board_open skips the
-- owner and members, and dedupes), so this is "a new person opened my list".
create or replace function public.board_opens_capture_received_view()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.posthog_capture(
    'received_view',
    new.owner_id,
    jsonb_build_object(
      'board_id',         new.board_id,
      'opened_in',        new.source,
      'viewer_signed_in', new.viewer_id is not null
    )
  );
  return new;
end;
$$;

drop trigger if exists board_opens_capture_received_view on public.board_opens;
create trigger board_opens_capture_received_view
  after insert on public.board_opens
  for each row execute function public.board_opens_capture_received_view();
