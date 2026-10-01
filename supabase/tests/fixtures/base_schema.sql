-- Minimal stand-in for the production schema the events migrations touch.
-- Columns, enums, constraints and is_event_admin() copied from prod
-- (2026-10-01). auth.uid() reads a session setting so tests can act as anyone:
--   select set_config('request.jwt.claim.sub', '<uuid>', false);
-- Supabase's API roles, so grants/revokes in migrations apply.
do $$ begin
  create role anon nologin;
  create role authenticated nologin;
exception when duplicate_object then null; end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create type public.ss_status as enum ('draft','open','locked','drawn','archived');
create type public.ss_invite_status as enum ('pending','accepted','declined','revoked');
create type public.ss_role as enum ('owner','admin','member');

create table public.profiles (id uuid primary key, display_name text);

create table public.ss_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  budget integer,
  currency text default 'EUR',
  event_date date,
  is_public boolean default false,
  status public.ss_status default 'draft',
  slug text not null unique,
  notes text,
  join_code_hash text,
  created_at timestamptz default now(),
  type text not null default 'secret_santa',
  cover_image_url text,
  join_token text not null default gen_random_uuid()::text
);

create table public.ss_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.ss_events(id) on delete cascade,
  user_id uuid not null,
  display_name text,
  role public.ss_role default 'member',
  wants text,
  address text,
  is_confirmed boolean default false,
  joined_at timestamptz default now(),
  unique (event_id, user_id)
);

create table public.ss_exclusions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.ss_events(id) on delete cascade,
  a uuid not null,
  b uuid not null,
  unique (event_id, a, b)
);

create table public.ss_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.ss_events(id) on delete cascade,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  status public.ss_invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (event_id, to_user)
);

create table public.ss_draws (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.ss_events(id) on delete cascade,
  created_by uuid not null,
  created_at timestamptz default now(),
  seed text,
  attempts integer
);

create table public.ss_assignments (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid references public.ss_draws(id) on delete cascade,
  event_id uuid references public.ss_events(id) on delete cascade,
  giver uuid not null,
  receiver uuid not null,
  revealed boolean default false,
  unique (event_id, giver)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.is_event_admin(e uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $function$
  select exists(
    select 1 from ss_events ev
    where ev.id = e and ev.owner_id = auth.uid()
  ) or exists(
    select 1 from ss_members m
    where m.event_id = e and m.user_id = auth.uid() and m.role in ('owner','admin')
  );
$function$;

-- As in prod: the owner becomes a confirmed owner-member on insert.
create or replace function public.ss_add_owner_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into ss_members (event_id, user_id, role, is_confirmed)
  values (new.id, new.owner_id, 'owner', true)
  on conflict (event_id, user_id) do nothing;
  return new;
end $$;
create trigger ss_add_owner_as_member_trigger after insert on public.ss_events
  for each row execute function public.ss_add_owner_as_member();

-- Prod's ss_notify_invite, so a migration replacing it has something to replace.
create or replace function public.ss_notify_invite(p_event_id uuid, p_invite_id uuid, p_to_user uuid, p_event_name text, p_slug text)
returns void language plpgsql security definer as $function$
begin
  if not is_event_admin(p_event_id) then raise exception 'not allowed'; end if;
  insert into notifications (user_id, type, payload)
  values (p_to_user, 'ss_invite', jsonb_build_object('event_id', p_event_id, 'invite_id', p_invite_id, 'event_name', p_event_name, 'slug', p_slug));
end;
$function$;
