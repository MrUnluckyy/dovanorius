import Link from "next/link";
import { redirect } from "next/navigation";
import { loginRedirect } from "@/utils/auth/account";
import { getTranslations } from "next-intl/server";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { createClient } from "@/utils/supabase/server";
import LobbyClient from "./_components/LobbyClient";

export default async function EventLobbyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Carry the destination through the login round-trip. Without `next` an
  // invited person lost the event entirely and landed on the dashboard.
  if (!user) redirect(loginRedirect(`/events/${slug}`));

  // RLS hides events you are not part of, so "no row" means "not yours" as
  // often as it means "does not exist". Say that plainly instead of rendering
  // an empty lobby that looks broken.
  const { data: event } = await supabase
    .from("ss_events")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!event) {
    const t = await getTranslations("Events");
    return (
      <main className="min-h-screen bg-(--nr-cream)">
        <NavigationV2 user={user} />
        <div className="mx-auto max-w-[440px] px-4 py-16">
          <div className="nr-card p-8 text-center">
            <span className="mb-5 inline-grid h-14 w-14 place-items-center rounded-full bg-(--nr-tile) text-2xl">
              🔒
            </span>
            <h1 className="nr-h2 mb-3 text-[24px]">{t("noAccessTitle")}</h1>
            <p className="nr-lead mb-7 text-[15px]">{t("noAccessBody")}</p>
            <Link href="/events" className="nr-btn nr-btn-primary w-full">
              {t("noAccessCta")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-(--nr-cream)">
      <NavigationV2 user={user} />
      <LobbyClient slug={slug} user={user} />
    </main>
  );
}
