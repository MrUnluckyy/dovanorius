import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { createClient } from "@/utils/supabase/server";
import { loginRedirect } from "@/utils/auth/account";
import MyRecipientClient from "../_components/MyRecipientClient";

export default async function MyRecipientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Guests belong here too: a link-joined participant gets drawn like anyone
  // else and this is where they come to see who they got.
  if (!user) redirect(loginRedirect(`/events/${slug}/my`));

  // Without this the client query returned null for an event RLS hides, and
  // the page sat on its skeleton forever — a hang rather than an answer.
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
      <MyRecipientClient slug={slug} />
    </main>
  );
}
