import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LuArrowRight } from "react-icons/lu";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Light consumer-framed "gift ideas" touch on the landing — points to the
 * Discover feature (AI gift suggestions), framed for shoppers. Deliberately
 * compact.
 */
export async function IdeasStrip() {
  const t = await getTranslations("Landing.ideas");
  return (
    <section className="nr-container py-6">
      <Reveal>
        <div className="flex flex-col items-center justify-between gap-4 rounded-[24px] border border-(--nr-border) bg-white px-7 py-6 text-center sm:flex-row sm:text-left">
          <div>
            <h3 className="nr-h3 mb-1 text-[20px]">🎁 {t("title")}</h3>
            <p className="text-[15px] text-(--nr-muted)">{t("body")}</p>
          </div>
          <Link
            href="/discover"
            className="nr-btn nr-btn-outline shrink-0"
          >
            {t("cta")}
            <LuArrowRight className="text-[16px]" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
