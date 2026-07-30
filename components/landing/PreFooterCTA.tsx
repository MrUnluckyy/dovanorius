import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppStoreButton } from "@/components/landing/AppStoreButton";
import { Reveal } from "@/components/ui/Reveal";

export async function PreFooterCTA() {
  const t = await getTranslations("Landing.cta");

  return (
    <section className="nr-container pb-16 pt-4 md:pb-[70px]">
      <Reveal>
        <div className="relative flex flex-col items-start justify-between gap-8 overflow-hidden rounded-[32px] bg-(--nr-yellow) px-8 py-12 md:flex-row md:items-center md:px-[60px] md:py-16">
          {/* ambient circle */}
          <div
            className="pointer-events-none absolute -right-14 -top-14 h-64 w-64 rounded-full bg-white/35"
            style={{ animation: "nrBobR 9s ease-in-out infinite" }}
          />
          <div className="relative">
            <h2 className="nr-display mb-3.5 text-[34px] md:text-[44px]">
              {t("title")}
            </h2>
            <p className="max-w-[460px] text-[17px] leading-snug text-(--nr-on-yellow-muted)">
              {t("body")}
            </p>
          </div>
          <div className="relative flex w-full flex-none flex-col gap-3.5 sm:flex-row md:w-auto">
            <Link
              href="/dashboard"
              className="nr-btn nr-btn-dark w-full sm:w-auto"
            >
              {t("start")}
            </Link>
            <AppStoreButton
              label={t("appStore")}
              className="nr-btn nr-btn-outline w-full !border-transparent !bg-white hover:!bg-[#fff8ea] sm:w-auto"
            />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
