import Link from "next/link";
import { LuMailWarning } from "react-icons/lu";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import Footer from "@/components/footer/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Where every failed auth link lands: a confirmation or reset link that has
 * expired, been used already, or been opened after a newer one was requested.
 *
 * Both the OTP route and the OAuth/PKCE callback used to redirect to paths that
 * did not exist (`/error` and this one), so the person who clicked a stale link
 * got a bare 404 — indistinguishable from the site being broken. The one thing
 * they need to know is that the link died, not their account, and that
 * requesting a fresh one works.
 */
export default async function AuthCodeError() {
  const t = await getTranslations("Auth");
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
              <LuMailWarning size={26} />
            </span>

            <h1 className="nr-h2 mb-3 text-[28px] md:text-[34px]">
              {t("linkErrorTitle")}
            </h1>

            <p className="nr-lead mb-4">{t("linkErrorLead")}</p>

            <p className="mb-8 text-[15px] leading-relaxed text-(--nr-muted)">
              {t("linkErrorWhatNow")}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/forgot-password"
                className="nr-btn nr-btn-primary w-full sm:w-auto"
              >
                {t("linkErrorRetry")}
              </Link>
              <Link
                href="/login"
                className="nr-btn nr-btn-outline w-full sm:w-auto"
              >
                {t("ctaLogin")}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
