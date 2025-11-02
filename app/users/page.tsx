import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { createClient } from "@/utils/supabase/server";

export default async function Users() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20">
        <h2>Here we are going to make a search for users page</h2>
      </main>
    </>
  );
}
