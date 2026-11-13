"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LuGift } from "react-icons/lu";
import type { RecipientKey } from "@/lib/discover/recipients";
import { daysUntil, inSeason, occasionsForStrip } from "@/lib/discover/occasions";
import { occasionHref } from "@/lib/discover/routes";

/**
 * "Progos": the occasion pages, under the budget on the hub and recipient
 * pages. What is in season (Christmas, Secret Santa from November) comes
 * first, in yellow, with the countdown. The chosen recipient and budget go
 * along, so "Moteriai, iki 50 €" → Kalėdos keeps both.
 */
export function OccasionStrip({
  recipient,
  budgetKey,
}: {
  recipient: RecipientKey | null;
  budgetKey: string;
}) {
  const t = useTranslations("Discover.occasion");
  const occasions = occasionsForStrip();

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="-mx-4 mt-2.5 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <span className="mr-1 w-[76px] shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-(--nr-gold-text)">
        {t("label")}
      </span>
      {occasions.map((o) => {
        const hot = inSeason(o);
        const days = hot ? daysUntil(o) : null;
        // Only recipients the occasion offers travel along.
        const kam = recipient && o.recipients.includes(recipient) ? recipient : null;
        return (
          <Link
            key={o.key}
            href={occasionHref(o.slug, kam, budgetKey)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium text-(--nr-ink) transition-colors ${
              hot
                ? "border-(--nr-yellow-deep) bg-(--nr-tile) hover:bg-(--nr-yellow)"
                : "border-(--nr-border) bg-(--nr-surface) hover:border-(--nr-ink)/40"
            }`}
          >
            {hot && <LuGift className="w-3.5" aria-hidden />}
            {t(`${o.key}.label`)}
            {days != null && (
              // Days are counted in Vilnius time on both sides; this only
              // differs across midnight, so don't fight hydration over it.
              <span suppressHydrationWarning className="text-(--nr-muted)">
                · {t("countdown", { days })}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
