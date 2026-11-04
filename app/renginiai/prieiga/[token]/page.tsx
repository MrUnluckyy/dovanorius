import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { hashAccessToken } from "@/lib/events/guestAccess";
import { EventAccessGate } from "@/app/renginiai/_components/EventAccessGate";

export const metadata: Metadata = {
  title: "Noriuto — renginys",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Where an emailed link lands. Rendering this spends nothing: a mail scanner
 * can fetch it all day, because only the button's POST opens the event.
 */
export default async function EventAccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("Events");

  const { data: link } = await supabaseAdmin
    .from("ss_access_links")
    .select("event_id, expires_at, used_at, ss_events(name, slug)")
    .eq("token_hash", hashAccessToken(token))
    .maybeSingle();
  const event = link?.ss_events as unknown as
    | { name: string; slug: string }
    | null
    | undefined;

  if (!link || !event) {
    return (
      <main className="min-h-screen bg-(--nr-cream) px-4 py-16">
        <div className="nr-card mx-auto max-w-[440px] p-8 text-center">
          <span className="mb-5 inline-grid h-14 w-14 place-items-center rounded-full bg-(--nr-tile) text-2xl">
            🔗
          </span>
          <h1 className="nr-h2 mb-3 text-[26px]">{t("joinDeadTitle")}</h1>
          <p className="nr-lead mb-7 text-[16px]">{t("accessDeadBody")}</p>
          <Link href="/renginiai" className="nr-btn nr-btn-primary w-full">
            {t("joinDeadCta")}
          </Link>
        </div>
      </main>
    );
  }

  // Clicking the same mail twice on a device that is already in should just
  // open the event, not say the link has expired.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: seat } = await supabase
      .from("ss_members")
      .select("id")
      .eq("event_id", link.event_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (seat) redirect(`/renginiai/${event.slug}`);
  }

  const usable =
    !link.used_at && new Date(link.expires_at).getTime() > Date.now();

  return (
    <main className="min-h-screen bg-(--nr-cream) px-4 py-16">
      <div className="mx-auto max-w-[440px]">
        {usable ? (
          <div className="nr-card animate-fade-up p-8 text-center">
            <span className="mb-5 inline-grid h-14 w-14 place-items-center rounded-full bg-(--nr-tile) text-2xl">
              🎁
            </span>
            <p className="mb-1 text-[14px] text-(--nr-gold-strong)">
              {t("accessReadyEyebrow")}
            </p>
            <h1 className="nr-h2 mb-3 text-[26px] leading-tight">{event.name}</h1>
            <p className="nr-lead mb-7 text-[15px]">{t("accessReadyBody")}</p>
            <form action="/api/events/access/open" method="post">
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="nr-btn nr-btn-primary w-full">
                {t("accessOpenCta")}
              </button>
            </form>
          </div>
        ) : (
          <EventAccessGate
            target={{ slug: event.slug }}
            loginNext={`/renginiai/${event.slug}`}
            title={t("accessExpiredTitle")}
            body={t("accessExpiredBody")}
          />
        )}
      </div>
    </main>
  );
}
