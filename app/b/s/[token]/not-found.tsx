import Link from "next/link";
import { LuLink2Off } from "react-icons/lu";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import Footer from "@/components/footer/Footer";

/**
 * Shown when a magic-link token no longer resolves to a board — revoked from
 * the share dialog, replaced by a regenerated one, or the board deleted.
 *
 * Worth its own page rather than the site-wide 404: everyone who lands here
 * arrived by clicking a link a friend sent them, usually from Messenger or a
 * Facebook post, and "Šis puslapis neegzistuoja" reads as though they typed
 * something wrong. They didn't — the link simply died after it was shared, and
 * the only way back in is a new one from the person who sent it.
 *
 * The token cannot be recovered (it is a random UUID with no history), so this
 * page deliberately offers no retry.
 */
export default async function MagicLinkNotFound() {
  const t = await getTranslations("Boards");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20">
        <section className="nr-container flex min-h-[60vh] items-center justify-center py-12 md:py-20">
          <div className="nr-card w-full max-w-[560px] p-8 text-center md:p-10">
            <span
              aria-hidden
              className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-(--nr-tile) text-(--nr-gold-strong)"
            >
              <LuLink2Off size={26} />
            </span>

            <p className="nr-overline mb-3">{t("sharePrivateTitle")}</p>

            <h1 className="nr-h2 mb-3 text-[28px] md:text-[34px]">
              {t("deadLinkTitle")}
            </h1>

            <p className="nr-lead mb-4">{t("deadLinkLead")}</p>

            <p className="mb-8 text-[15px] leading-relaxed text-(--nr-muted)">
              {t("deadLinkWhatNow")}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/" className="nr-btn nr-btn-primary w-full sm:w-auto">
                {t("deadLinkHome")}
              </Link>
              <Link
                href="/discover"
                className="nr-btn nr-btn-outline w-full sm:w-auto"
              >
                {t("deadLinkDiscover")}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
