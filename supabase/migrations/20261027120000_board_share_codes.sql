-- Board share links: a short random code, assigned by the database, that
-- never changes.
--
-- Slugs used to be generateSlug(name) — "dovanos-kaledoms-3fa9c1" — built by
-- each client at insert time. Renaming the board kept the slug, so a board
-- called "Gimtadienis" was shared as /b/dovanos-kaledoms-…. Regenerating the
-- slug on rename would have broken every link already sent to friends.
--
-- Instead the slug stops carrying the name at all: /b/k7x2m9pq. It is set
-- here, not in the clients, so the web and the mobile app (same project, own
-- generators) both get it without a release; whatever slug a client sends on
-- insert is replaced. Once set, a slug is immutable, which is what keeps every
-- shared /b/<slug> link working forever — existing name-based slugs included.

create or replace function public.new_board_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  -- No 0/o, 1/l/i: the code gets read out loud and typed from screenshots.
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  bytes bytea;
  code text;
begin
  loop
    bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    code := '';
    for i in 0..7 loop
      code := code || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
    end loop;
    -- 31^8 ≈ 8.5e11 codes; a collision is near impossible, but cheap to rule out.
    exit when not exists (select 1 from public.boards where slug = code);
  end loop;
  return code;
end;
$$;

create or replace function public.boards_assign_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.slug := public.new_board_code();
  elsif old.slug is not null then
    -- Shared links must never break: a set slug can't be changed or cleared.
    new.slug := old.slug;
  else
    -- A legacy row without a slug (none today) gets a code when first touched.
    new.slug := public.new_board_code();
  end if;
  return new;
end;
$$;

drop trigger if exists boards_assign_slug on public.boards;
create trigger boards_assign_slug
  before insert or update of slug on public.boards
  for each row execute function public.boards_assign_slug();

-- The two unique indexes are the same constraint twice; keep the real one.
drop index if exists public.boards_slug_unique;
