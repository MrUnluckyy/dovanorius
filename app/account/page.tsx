import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LuUserPen } from "react-icons/lu";
import { createClient } from "@/utils/supabase/server";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import Footer from "@/components/footer/Footer";
import { ChangeEmailForm } from "./_components/ChangeEmailForm";
import { ChangePasswordForm } from "./_components/ChangePasswordForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Noriuto.lt - paskyros nustatymai",
  robots: { index: false, follow: false },
};

/**
 * Sign-in credentials only.
 *
 * Display name, avatar and bio are already editable from the dashboard
 * (UserEditModal), so they are deliberately not repeated here — two places to
 * change one name is how they end up disagreeing. This page covers the two
 * things that had nowhere to live at all: the email address and the password.
 */
export default async function AccountSettings() {
  const t = await getTranslations("Account");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // An anonymous guest has no credentials to change, and no password to prove
  // they know — there is nothing on this page they could use.
  if (!user || user.is_anonymous) {
    redirect("/login?next=%2Faccount");
  }

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20">
        <section className="nr-container py-10 md:py-16">
          <div className="mx-auto w-full max-w-[640px]">
            <h1 className="nr-h2 mb-2 text-[28px] md:text-[34px]">
              {t("title")}
            </h1>
            <p className="nr-lead mb-8">{t("lead")}</p>

            <div className="nr-card mb-5 p-6 md:p-8">
              <h2 className="text-lg font-semibold font-heading mb-1">
                {t("emailSectionTitle")}
              </h2>
              <p className="mb-5 text-sm text-base-content/70">
                {t("emailSectionLead")}
              </p>
              <ChangeEmailForm currentEmail={user.email ?? ""} />
            </div>

            <div className="nr-card mb-5 p-6 md:p-8">
              <h2 className="text-lg font-semibold font-heading mb-1">
                {t("passwordSectionTitle")}
              </h2>
              <p className="mb-5 text-sm text-base-content/70">
                {t("passwordSectionLead")}
              </p>
              <ChangePasswordForm email={user.email ?? ""} />
            </div>

            {/* Points at the existing editor rather than duplicating it. */}
            <div className="nr-card flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
              <div>
                <h2 className="text-lg font-semibold font-heading mb-1">
                  {t("profileSectionTitle")}
                </h2>
                <p className="text-sm text-base-content/70">
                  {t("profileSectionLead")}
                </p>
              </div>
              <Link
                href="/dashboard"
                className="nr-btn nr-btn-outline shrink-0 gap-2"
              >
                <LuUserPen size={16} />
                {t("ctaEditProfile")}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
