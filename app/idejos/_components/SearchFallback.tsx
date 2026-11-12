"use client";

import { useTranslations } from "next-intl";
import { LuSearchX } from "react-icons/lu";
import type { InspoProduct } from "@/types/inspo";
import { ProductCard, type CardProduct } from "./ProductCard";
import { toCardProduct } from "./CollectionRow";

/** What search_fallback() answers for a search that found nothing. */
export type SearchFallback = {
  mode: "corrected" | "relaxed" | "popular";
  /** The query to show instead; null for "popular". */
  q: string | null;
  /** Words of the original query that were left out. */
  dropped: string[];
};

/**
 * A search that found nothing still shows products: the spelling fix, the
 * query without the words nothing matched, or popular gifts. Always says so,
 * so nobody thinks "adidas" results are "adidas samba".
 */
export function SearchFallbackView({
  search,
  fallback,
  loading,
  products,
  hasMore,
  loadingMore,
  onMore,
  onOpen,
  onApply,
}: {
  search: string;
  fallback: SearchFallback | null;
  loading: boolean;
  products: InspoProduct[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onOpen: (p: CardProduct) => void;
  /** Make the fallback query the real search (it then gets the chip, sort…). */
  onApply: (term: string) => void;
}) {
  const t = useTranslations("Discover.fallback");
  const typed = `„${search.trim()}“`;
  const q = fallback?.q ? `„${fallback.q}“` : "";

  if (!fallback || loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-md opacity-60" />
      </div>
    );
  }

  return (
    <>
      <div
        role="status"
        className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-(--nr-border) bg-(--nr-surface) px-4 py-3.5 sm:px-5"
      >
        <LuSearchX className="w-5 shrink-0 text-(--nr-muted)" aria-hidden />
        <p className="min-w-0 flex-1 text-[15px] text-(--nr-ink)">
          {t(fallback.mode, { typed, q })}
        </p>
        {fallback.q && (
          <button
            type="button"
            onClick={() => onApply(fallback.q!)}
            className="cursor-pointer whitespace-nowrap text-sm font-semibold underline underline-offset-4"
          >
            {t("searchFor", { q })}
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <p className="py-16 text-center opacity-75">{t("nothing")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((p) => {
            const card = toCardProduct(p);
            return <ProductCard key={p.id} product={card} onOpen={() => onOpen(card)} />;
          })}
        </div>
      )}

      {hasMore && (
        <div className="mt-10 flex justify-center">
          <button
            className="btn btn-neutral btn-wide cursor-pointer rounded-full"
            onClick={onMore}
            disabled={loadingMore}
            data-busy={loadingMore || undefined}
          >
            {t("more")}
          </button>
        </div>
      )}
    </>
  );
}
