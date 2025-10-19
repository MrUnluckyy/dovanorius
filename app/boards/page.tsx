import { Navigation } from "@/components/navigation/Navigation";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { UserBar } from "./components/UserBar";
import { BoardsList } from "./components/BoardsList";

export default async function BoardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main>
      <Navigation user={user} />

      <div className="max-w-[1400px] mx-auto min-h-screen">
        <div className="py-8 mb-10">
          <UserBar userId={user.id} />
        </div>
        <BoardsList user={user} />
      </div>
    </main>
  );
}
