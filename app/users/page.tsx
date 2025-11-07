import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { createClient } from "@/utils/supabase/server";
import { SearchUsers } from "./components/SearchUsers";

export default async function Users() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("public", true)
    .limit(10);

  return (
    <>
      <main className="pb-20">
        <NavigationV2 user={user} />
        <div className="max-w-[1440px] mx-auto min-h-screen px-4">
          <Breadcrumbs />
          <div className="py-8 mb-4 md:mb-10">
            <SearchUsers />
          </div>
        </div>
      </main>
    </>
  );
}
