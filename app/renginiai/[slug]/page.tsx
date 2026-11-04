import Link from "next/link";
import { isAccountUser } from "@/utils/auth/account";
import { claimGuestEventSeats } from "@/lib/claimGuestReservations";
import { EventAccessGate } from "@/app/renginiai/_components/EventAccessGate";
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
  const t = await getTranslations("Events");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A guest seat under this account's address comes home before we look, so
  // someone already signed in with Google does not have to sign in again.
  if (isAccountUser(user)) await claimGuestEventSeats(supabase);

  // RLS hides events you are not part of, so "no row" means "not yours" as
  // often as it means "does not exist". Nobody signed in reaches this page
  // through a login wall any more: a guest on a new device has no login, and
  // needs the emailed way back. Same screen either way, so it confirms nothing.
  const { data: event } = user
    ? await supabase.from("ss_events").select("id").eq("slug", slug).maybeSingle()
    : { data: null };

  if (!user || !event) {
    return (
      <main className="min-h-screen bg-(--nr-cream)">
        <NavigationV2 user={user} />
        <div className="mx-auto max-w-[440px] px-4 py-16">
          <EventAccessGate
            target={{ slug }}
            loginNext={`/renginiai/${slug}`}
            signedInAs={isAccountUser(user) ? user.email ?? null : null}
          />
          {isAccountUser(user) && (
            <Link
              href="/renginiai"
              className="mt-5 block text-center text-[14px] font-semibold text-(--nr-gold-strong) underline underline-offset-2"
            >
              {t("noAccessCta")}
            </Link>
          )}
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
