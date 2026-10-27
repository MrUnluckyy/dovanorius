"use client";

import { useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { ProductCard, type CardProduct } from "../ProductCard";

/**
 * A titled, horizontally scrolling row of products. No panel behind it: the
 * title and the packshots carry the section, the page background runs through.
 * Snaps per card on touch; arrow buttons on pointer devices.
 */
export function Rail({
  title,
  reason,
  href,
  items,
  isLoading,
  onOpen,
}: {
  title: string;
  /** Why this row is here, in one line. */
  reason?: string | null;
  /** Full page for this row ("Žiūrėti visas"). */
  href?: string;
  items: CardProduct[];
  isLoading?: boolean;
  onOpen: (p: CardProduct) => void;
}) {
  const t = useTranslations("Discover.hub");
  const scroller = useRef<HTMLDivElement>(null);

  if (!isLoading && items.length === 0) return null;

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="group/rail">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-heading text-[22px] font-bold leading-tight tracking-[-0.02em] text-(--nr-ink) sm:text-[26px]">
            {title}
          </h2>
          {reason && <p className="mt-1 text-[14px] text-(--nr-muted)">{reason}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="hidden gap-1 md:flex">
            <button
              type="button"
              onClick={() => page(-1)}
              aria-label={t("prev")}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-(--nr-ink) transition-colors hover:bg-(--nr-stage)"
            >
              <LuChevronLeft className="w-5" />
            </button>
            <button
              type="button"
              onClick={() => page(1)}
              aria-label={t("next")}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-(--nr-ink) transition-colors hover:bg-(--nr-stage)"
            >
              <LuChevronRight className="w-5" />
            </button>
          </div>
          {href && (
            <Link
              href={href}
              className="ml-1 whitespace-nowrap text-[14px] font-semibold text-(--nr-ink) underline decoration-(--nr-border) decoration-2 underline-offset-[6px] transition-colors hover:decoration-(--nr-ink)"
            >
              {t("seeAll")}
            </Link>
          )}
        </div>
      </div>

      <div
        ref={scroller}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:gap-4 sm:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-[42vw] shrink-0 sm:w-[220px]">
                <div className="nr-skeleton aspect-[4/5] w-full rounded-xl" />
                <div className="nr-skeleton mt-2.5 h-3 w-2/3 rounded" />
                <div className="nr-skeleton mt-2 h-3 w-1/2 rounded" />
              </div>
            ))
          : items.map((p) => (
              <div key={p.id} className="w-[42vw] shrink-0 snap-start sm:w-[220px]">
                <ProductCard product={p} onOpen={() => onOpen(p)} />
              </div>
            ))}
      </div>
    </section>
  );
}
