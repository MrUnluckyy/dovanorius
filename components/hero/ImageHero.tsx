import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppStoreButton } from "@/components/landing/AppStoreButton";
import { HeroCollage } from "@/components/hero/HeroCollage";

export async function ImageHero() {
  const t = await getTranslations("Landing.hero");
  return (
    <section>
      {/* headline block */}
      <div className="mx-auto max-w-[880px] px-[18px] pb-2 pt-10 text-center md:px-12 md:pt-14">
        <span className="nr-badge nr-badge-outline nr-anim-fadeup mb-5">
          🎁 {t("badge")}
        </span>
        <h1
          className="nr-display nr-anim-fadeup mb-5 text-[40px] md:text-[68px]"
          style={{ animationDelay: "0.1s" }}
        >
          {t("title")}
        </h1>
        <p
          className="nr-lead nr-anim-fadeup mx-auto mb-7 max-w-[620px]"
          style={{ animationDelay: "0.22s" }}
        >
          {t("subtitle")}
        </p>
        <div
          className="nr-anim-fadeup flex flex-col items-center justify-center gap-3.5 sm:flex-row"
          style={{ animationDelay: "0.34s" }}
        >
          <Link
            href="/dashboard"
            className="nr-btn nr-btn-primary w-full sm:w-auto"
            style={{ animation: "nrPulse 3.2s ease-out 1.6s infinite" }}
          >
            {t("ctaCreate")}
          </Link>
          {/* Third CTA, deliberately the quiet one: creating a list is still
              the primary action, but "browse ideas" is the only entry that asks
              nothing of a first-time visitor — no account, no list, no thinking
              about who it is for. Outline weight so it reads as an alternative
              rather than competing with the primary. */}
          <Link
            href="/discover"
            className="nr-btn nr-btn-outline w-full sm:w-auto"
          >
            {t("ctaDiscover")}
          </Link>
          <AppStoreButton
            label={t("appStore")}
            className="nr-btn nr-btn-dark w-full sm:w-auto"
          />
        </div>
      </div>

      {/* collage */}
      <HeroCollage chipAdded={t("chipAdded")} chipReserved={t("chipReserved")} />
    </section>
  );
}
