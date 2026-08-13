"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LuSparkles, LuUserRound, LuChevronUp } from "react-icons/lu";
import {
  usePersonaPicks,
  useShelfContinuation,
  SHELF_SIZE,
  type GiftPersona,
} from "@/hooks/usePersonas";
import { MIN_ITEMS } from "@/lib/discover/shelf-rules";
import { toCardProduct } from "./CollectionRow";
import { ProductCard, type CardProduct } from "./ProductCard";
import { ProductStrip } from "./ProductStrip";

/**
 * A curated shelf, with "view more" expanding in two tiers.
 *
 * Tier 1 is the rest of the curated picks. Tier 2 is everything else in the
 * categories this shelf actually produced — deliberately separated by a heading
 * that says it is no longer hand-picked.
 *
 * That honesty is the design. Feedback asked for more items, but a curated shelf
 * only holds 7-29: the extra depth has to come from somewhere less curated, and
 * silently appending weaker items to the same row is exactly what made the old
 * page feel random. Naming the boundary keeps the curated part trustworthy.
 *
 * Editorial shelves opt out of tier 2 altogether — a statement shelf someone
 * assembled by hand is diluted, not deepened, by bulk category filler.
 */

export function PersonaShelf({
  persona,
  onOpen,
}: {
  persona: GiftPersona;
  onOpen: (p: CardProduct) => void;
}) {
  const t = useTranslations("Discover");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);

  const isEditorial = persona.kind === "editorial";

  // Hand-picked shelves keep the curator's ranking; see usePersonaPicks.
  const { data, isLoading } = usePersonaPicks(persona.id, { rotate: !isEditorial });
  const picks = data ?? [];

  // Only the types the curator actually chose — see useShelfContinuation.
  const types = Array.from(
    new Set(picks.map((p) => p.product_type).filter(Boolean) as string[])
  );
  const { data: more = [] } = useShelfContinuation(
    types,
    picks.map((p) => p.id),
    // The shelf's own exclude list guards the second tier too. Without it the
    // tech continuation came back as laptop bags — precisely what the curator
    // had just rejected — because `tech` still holds 790 of them and they
    // outrank real gadgets on brand and price.
    persona.exclude_keywords ?? [],
    expanded && !isEditorial
  );

  const label = locale === "en" ? persona.label_en : persona.label_lt;
  // Editorial shelves render exactly like themes — inline, sparkle icon, own
  // title. The difference is where the picks come from, not how they look.
  const isTheme = persona.kind === "theme" || isEditorial;
  const items: CardProduct[] = picks.map((p) => ({
    ...toCardProduct(p),
    reason: p.reason,
  }));

  if (!isLoading && items.length < MIN_ITEMS) return null;

  if (!expanded) {
    return (
      <ProductStrip
        title={isTheme ? label : t("personaShelfTitle", { persona: label })}
        subtitle={isTheme ? t("themeShelfSubtitle") : t("personaShelfSubtitle")}
        Icon={isTheme ? LuSparkles : LuUserRound}
        items={items.slice(0, SHELF_SIZE)}
        isLoading={isLoading}
        onOpen={onOpen}
        // Offering "view more" when there is nothing more to show, and no
        // second tier either, would be a dead end. An editorial shelf has no
        // second tier at all, so for it the only reason to expand is having
        // more picks than fit.
        onSeeAll={
          items.length > SHELF_SIZE || (types.length > 0 && !isEditorial)
            ? () => setExpanded(true)
            : undefined
        }
      />
    );
  }

  return (
    <section className="rounded-3xl bg-base-200/50 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight sm:text-xl">
            {isTheme ? (
              <LuSparkles className="w-5 shrink-0 text-primary" aria-hidden />
            ) : (
              <LuUserRound className="w-5 shrink-0 text-primary" aria-hidden />
            )}
            {isTheme ? label : t("personaShelfTitle", { persona: label })}
          </h3>
          <p className="mt-0.5 text-sm opacity-60">
            {isTheme ? t("themeShelfSubtitle") : t("personaShelfSubtitle")}
          </p>
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="btn btn-ghost btn-sm cursor-pointer gap-1 rounded-full"
        >
          {t("collapse")}
          <LuChevronUp className="w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} onOpen={() => onOpen(p)} />
        ))}
      </div>

      {more.length > 0 && (
        <>
          <div className="mb-4 mt-8 border-t border-base-300 pt-4">
            <h4 className="font-heading text-base font-bold tracking-tight">
              {t("moreFromCategory")}
            </h4>
            <p className="mt-0.5 text-sm opacity-55">{t("moreFromCategoryNote")}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {more.map((p) => {
              const card = toCardProduct(p);
              return (
                <ProductCard
                  key={p.id}
                  product={card}
                  onOpen={() => onOpen(card)}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
