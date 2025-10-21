import { SimpleHero } from "@/components/hero/SimpleHero";
import { Navigation } from "@/components/navigation/Navigation";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Navigation user={user} />
      <main>
        <SimpleHero user={user} />
      </main>
    </>
  );
}
