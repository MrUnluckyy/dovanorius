"use client";

import { useTranslations } from "next-intl";
import { LuArrowRight } from "react-icons/lu";
import type { IconType } from "react-icons";
import { ProductCard, type CardProduct } from "./ProductCard";

/** Shared horizontal editorial strip used by collections and AI suggestions. */
export function ProductStrip({
  title,
  subtitle,
  Icon,
  items,
  isLoading,
  onOpen,
  onSeeAll,
}: {
  title: string;
  /** The editorial line — why this shelf exists. What turns a grid into a page. */
  subtitle?: string;
  Icon?: IconType;
  items: CardProduct[];
  isLoading: boolean;
  onOpen: (p: CardProduct) => void;
  onSeeAll?: () => void;
}) {
  const t = useTranslations("Discover");

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="rounded-3xl bg-base-200/50 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight sm:text-xl">
            {Icon && <Icon className="w-5 shrink-0 text-primary" aria-hidden />}
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-sm opacity-60">{subtitle}</p>
          )}
        </div>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="btn btn-ghost btn-sm cursor-pointer gap-1 rounded-full"
          >
            {t("seeAll")}
            <LuArrowRight className="w-4" />
          </button>
        )}
      </div>

      <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="nr-skeleton h-80 w-44 shrink-0 rounded-2xl sm:w-48"
              />
            ))
          : items.map((p) => (
              <div key={p.id} className="w-44 shrink-0 snap-start sm:w-48">
                <ProductCard product={p} onOpen={() => onOpen(p)} />
              </div>
            ))}
      </div>
    </section>
  );
}
