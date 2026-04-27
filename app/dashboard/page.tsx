import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { DashboardUser } from "./components/DashboardUser";
import { DashboardTabs } from "./components/DashboardTabs";
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
        <div className="max-w-[1440px] mx-auto min-h-screen px-4">
          <div className="py-8 mb-4 md:mb-10">
            <DashboardUser />
          </div>
          <DashboardTabs user={user} />
        </div>
      </main>
      <Footer />
    </>
  );
}
