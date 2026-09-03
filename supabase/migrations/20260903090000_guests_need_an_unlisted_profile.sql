-- HOTFIX for 20260902090000. Skipping profile creation for guests broke
-- reserving outright.
--
-- items.reserved_by REFERENCES profiles(id), so a guest with no profile row
-- cannot be written into reserved_by at all: reserve_item_with_contact fell
-- over with "violates foreign key constraint items_reserved_by_fkey", the RPC
-- threw, and the client showed its generic "Upsss" with nothing else. Every
-- guest reservation failed from 2026-09-02 17:16 to 2026-09-03 08:20.
-- board_members.user_id has the same FK, so guest board invites were broken
-- the same way.
--
-- The profile row was never the problem. A PUBLIC profile and a PUBLISHED
-- empty board were. So a guest gets a row, unlisted, and still no board.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
  DECLARE
    _name   text;
    _avatar text;
  BEGIN
    IF new.is_anonymous THEN
      -- Required by items_reserved_by_fkey and board_members_user_id_fkey.
      -- Explicitly unlisted: `public` defaults to true, which is what put 57
      -- nameless guests into the people directory.
      INSERT INTO public.profiles (id, public)
      VALUES (new.id, false)
      ON CONFLICT (id) DO NOTHING;
      -- Still no default board: an empty published wishlist per guest.
      RETURN new;
    END IF;

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

    -- DO UPDATE, not DO NOTHING: on the guest-to-account upgrade the row
    -- already exists with public = false, and leaving it that way would hide
    -- a real member from the directory forever. Existing values win over the
    -- metadata so this can never blank a name someone already set.
    INSERT INTO public.profiles (id, display_name, avatar_url, public)
    VALUES (new.id, _name, _avatar, true)
    ON CONFLICT (id) DO UPDATE
      SET display_name = coalesce(profiles.display_name, EXCLUDED.display_name),
          avatar_url   = coalesce(profiles.avatar_url,   EXCLUDED.avatar_url),
          public       = true;

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

-- Guests stranded while the bug was live: without this their existing session
-- still cannot reserve, because the trigger only fires on new sign-ins.
insert into public.profiles (id, public)
select u.id, false
from auth.users u
left join public.profiles p on p.id = u.id
where u.is_anonymous and p.id is null
on conflict (id) do nothing;
