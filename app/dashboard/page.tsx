import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { DashboardUser } from "./components/DashboardUser";
import { DashboardTabs } from "./components/DashboardTabs";
import Footer from "@/components/footer/Footer";
import { AndroidTesterBanner } from "./components/AndroidTesterBanner";
import { isAndroidCandidate, isAndroidDevice } from "./components/androidUa";

export default async function BoardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user || error) redirect("/login");

  // A row here is an answer already given — "I'm in" or "not me" — and either
  // way the prompt is done. Read server-side so it never flashes in and out on
  // load. A failed read (the table not migrated yet) hides it rather than
  // breaking the dashboard.
  const { data: testerRow } = await supabase
    .from("android_tester_interest")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const userAgent = (await headers()).get("user-agent");
  const onAndroid = isAndroidDevice(userAgent);

  const showTesterPrompt =
    testerRow === null &&
    // Guests reach this page too — an anonymous session passes the redirect
    // above, which is why the nav treats `is_anonymous` as signed out. They
    // have no account, usually no email, and the action rejects them on
    // submit, so the prompt would be a form that cannot be completed.
    !user.is_anonymous &&
    // An iPhone reader cannot help however willing they are; everyone else,
    // desktop included, stays eligible.
    isAndroidCandidate(userAgent);

  // Most accounts are already on Gmail, so the field is usually just a
  // confirmation. For the rest it starts empty — a prefilled wrong address is
  // worse than a blank one, because it gets submitted unread.
  const accountEmail = user.email ?? "";
  const testerDefaultEmail = accountEmail.endsWith("@gmail.com")
    ? accountEmail
    : "";

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20">
        <div className="max-w-[1440px] mx-auto min-h-screen px-4">
          <div className="py-8 mb-4 md:mb-10">
            <DashboardUser />
          </div>
          {showTesterPrompt && (
            <AndroidTesterBanner
              defaultEmail={testerDefaultEmail}
              onAndroid={onAndroid}
            />
          )}
          <DashboardTabs user={user} />
        </div>
      </main>
      <Footer />
    </>
  );
}
