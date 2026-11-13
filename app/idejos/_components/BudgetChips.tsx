"use client";

import { useTranslations } from "next-intl";
import { PRICE_BANDS, priceBand, priceBandLabel } from "./filters";

/**
 * "How much do you want to spend?" as one row of chips, always visible.
 * Price is the first thing a gift giver knows, and it used to sit behind the
 * Filtrai popover on one page only.
 */
export function BudgetChips({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  const t = useTranslations("Discover");
  const current = priceBand(value);
  // A budget from a link or a search ("iki 30 eur") gets its own chip.
  const custom = PRICE_BANDS.some((b) => b.key === current.key) ? null : current;
  const bands = custom ? [PRICE_BANDS[0], custom, ...PRICE_BANDS.slice(1)] : PRICE_BANDS;

  return (
    <div
      role="group"
      aria-label={t("price.label")}
      className={`-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden ${className}`}
    >
      <span className="mr-1 shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-(--nr-gold-text)">
        {t("price.label")}
      </span>
      {bands.map((b) => {
        const active = b.key === current.key;
        return (
          <button
            key={b.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? "all" : b.key)}
            className={`shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium text-(--nr-ink) transition-transform active:scale-[0.97] ${
              active
                ? "border-(--nr-yellow-deep) bg-(--nr-yellow) shadow-(--nr-shadow-btn)"
                : "border-(--nr-border) bg-(--nr-surface) hover:border-(--nr-ink)/40"
            }`}
          >
            {priceBandLabel(t, b)}
          </button>
        );
      })}
    </div>
  );
}
