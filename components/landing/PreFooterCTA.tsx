import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StoreLinks } from "@/components/landing/StoreLinks";
import { Reveal } from "@/components/ui/Reveal";
import { devicePlatform } from "@/lib/device";

export async function PreFooterCTA() {
  const t = await getTranslations("Landing.cta");
  const platform = devicePlatform((await headers()).get("user-agent"));

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
          {/* Stacked, not side by side: the web and the app are two different
              decisions, and on yellow the store pill needs its own white
              ground to stay readable. */}
          <div className="relative flex w-full flex-none flex-col items-stretch gap-3.5 md:w-auto">
            <Link href="/dashboard" className="nr-btn nr-btn-dark">
              {t("start")}
            </Link>
            <StoreLinks platform={platform} tone="yellow" />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
