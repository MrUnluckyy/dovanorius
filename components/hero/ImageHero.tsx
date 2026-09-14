import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  PlayGlyph,
  PLAY_URL,
  StoreLinks,
} from "@/components/landing/StoreLinks";
import { HeroCollage } from "@/components/hero/HeroCollage";
import { devicePlatform } from "@/lib/device";

export async function ImageHero() {
  const t = await getTranslations("Landing.hero");
  const platform = devicePlatform((await headers()).get("user-agent"));

  return (
    <section>
      {/* headline block */}
      <div className="mx-auto max-w-[880px] px-[18px] pb-2 pt-10 text-center md:px-12 md:pt-14">
        {/* The badge slot used to list where Noriuto runs; the Android release
            is the more interesting thing it can say, and it is the one line
            above the headline everyone reads. "Free" has not gone missing —
            the primary button underneath says it. */}
        <Link
          href={PLAY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="nr-badge nr-badge-tint nr-anim-fadeup mb-5 transition-colors hover:bg-(--nr-yellow-soft)"
        >
          <PlayGlyph size={14} />
          {t("badge")}
        </Link>
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
        </div>
        {/* The stores sit a step below the two web CTAs rather than in line
            with them: a fourth button made the row a menu, and the app is a
            second way into the same thing, not a fourth thing to choose. */}
        <div
          className="nr-anim-fadeup mt-5 flex justify-center"
          style={{ animationDelay: "0.46s" }}
        >
          <StoreLinks platform={platform} />
        </div>
      </div>

      {/* collage */}
      <HeroCollage chipAdded={t("chipAdded")} chipReserved={t("chipReserved")} />
    </section>
  );
}
