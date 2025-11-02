import { Navigation } from "@/components/navigation/Navigation";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { UserBar } from "./components/UserBar";
import { BoardsList } from "./components/BoardsList";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";

export default async function BoardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user || error) redirect("/login");

  return (
    <main className="pb-20">
      <Navigation user={user} />

      <div className="max-w-[1440px] mx-auto min-h-screen px-4">
        <Breadcrumbs />
        <div className="py-8 mb-4 md:mb-10">
          <UserBar />
        </div>

        <BoardsList user={user} />
      </div>
    </main>
  );
}
