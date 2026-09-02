-- Stop provisioning guests as if they had joined.
--
-- handle_new_user() fires on every auth.users insert, anonymous sessions
-- included. So every guest who reserved a gift silently got a profiles row and
-- a default "Mano norai" board — and since both `profiles.public` and
-- `boards.is_public` default to true, that board was PUBLISHED and that
-- profile listed. On prod that is 57 empty public boards and 57 nameless
-- entries in a people directory of 222.
--
-- Reserving a gift is the one thing a guest is meant to do without an account.
-- It should not make them a member.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
  DECLARE
    _name   text;
    _avatar text;
  BEGIN
    -- A guest is not a new member. They get provisioned if and when they
    -- upgrade to a real account, by the trigger below.
    IF new.is_anonymous THEN
      RETURN new;
    END IF;

    -- Prefer app-provided display_name, then common OAuth name fields
    _name := coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(trim(
        coalesce(new.raw_user_meta_data->>'given_name','') || ' ' ||
        coalesce(new.raw_user_meta_data->>'family_name','')
      ), '')
    );

    _avatar := coalesce(
      nullif(new.raw_user_meta_data->>'avatar_url',''),
      nullif(new.raw_user_meta_data->>'picture','')
    );

    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (new.id, _name, _avatar)
    ON CONFLICT (id) DO NOTHING;

    -- Create default board with slug (idempotent)
    INSERT INTO public.boards (owner_id, name, slug)
    SELECT
      new.id,
      'Mano norai',
      'mano-norai-' || substr(gen_random_uuid()::text, 1, 6)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.boards b WHERE b.owner_id = new.id
    );

    RETURN new;
  END;
$$;

-- The guest-to-account upgrade keeps the same auth.uid() and only flips
-- is_anonymous, so it is an UPDATE and the INSERT trigger never sees it.
-- Without this, a guest who takes the "create an account" option mid-reserve
-- would end up with an account and no profile row at all.
--
-- The function body is idempotent (ON CONFLICT DO NOTHING / WHERE NOT EXISTS),
-- so firing it a second time for someone already provisioned is harmless.
drop trigger if exists on_auth_user_upgraded on auth.users;
create trigger on_auth_user_upgraded
  after update of is_anonymous on auth.users
  for each row
  when (old.is_anonymous and not new.is_anonymous)
  execute function public.handle_new_user();
