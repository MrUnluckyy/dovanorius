import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { DashboardUser } from "./components/DashboardUser";
import { DashboardTabs } from "./components/DashboardTabs";
import Footer from "@/components/footer/Footer";
import {
  AndroidLaunchBanner,
  APP_LAUNCH_COOKIE,
} from "./components/AndroidLaunchBanner";
import { devicePlatform } from "@/lib/device";

export default async function BoardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user || error) redirect("/login");

  const platform = devicePlatform((await headers()).get("user-agent"));
  const seenLaunch = (await cookies()).get(APP_LAUNCH_COOKIE)?.value === "1";

  // An iPhone reader has had the app since it shipped there; the news is the
  // Android release, so they are the one group with nothing to be told.
  // Desktop stays in: a laptop UA says nothing about the phone in the pocket.
  const showAppLaunch = platform !== "ios" && !seenLaunch;

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20">
        <div className="max-w-[1440px] mx-auto min-h-screen px-4">
          <div className="py-8 mb-4 md:mb-10">
            <DashboardUser />
          </div>
          {showAppLaunch && <AndroidLaunchBanner platform={platform} />}
          <DashboardTabs user={user} />
        </div>
      </main>
      <Footer />
    </>
  );
}
