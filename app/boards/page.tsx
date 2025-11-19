import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { UserBar } from "./components/UserBar";
import { BoardsList } from "./components/BoardsList";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import Footer from "@/components/footer/Footer";

export default async function BoardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user || error) redirect("/login");

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20">
        <div className="max-w-[1440px] mx-auto min-h-screen px-4 flex flex-col gap-8">
          <Breadcrumbs />

          <BoardsList user={user} />
        </div>
      </main>
      <Footer />
    </>
  );
}
