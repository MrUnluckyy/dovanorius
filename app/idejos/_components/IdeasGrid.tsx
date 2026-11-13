"use client";

import { useTranslations } from "next-intl";
import { useInspoProducts } from "@/hooks/useInspoProducts";
import { ideasGridFilters, type InitialGrid } from "@/lib/discover/gridQuery";
import type { Audience } from "@/types/inspo";
import { toCardProduct } from "./CollectionRow";
import { ProductCard, type CardProduct } from "./ProductCard";

/**
 * "Daugiau dovanų idėjų": the curated grid under the shelves, narrowed by the
 * chosen recipient. Same query as default browse (gift_score order), so it
 * improves for free as ranking and tiers land. A button, not infinite scroll:
 * that is T12, together with keyset pagination.
 */
export function IdeasGrid({
  title,
  audience,
  productType,
  productTypes,
  ageGroup,
  priceMin,
  priceMax,
  boostTypes,
  initial,
  onOpen,
}: {
  title: string;
  audience: Audience;
  productType: string | null;
  /** A recipient's gift categories, when no single category is chosen. */
  productTypes?: string[];
  /** kid | teen | adult, from the recipient; null = every age. */
  ageGroup?: "kid" | "teen" | "adult" | null;
  /** Budget, e.g. "iki 20 €" or a Secret Santa limit. */
  priceMin?: number | null;
  priceMax?: number | null;
  /** Types the recipient's page pulls forward (see ideasGridScope). */
  boostTypes?: string[] | null;
  /** First page rendered on the server, used when it matches these filters. */
  initial?: InitialGrid | null;
  onOpen: (p: CardProduct) => void;
}) {
  const t = useTranslations("Discover");
  const filters = ideasGridFilters({ audience, productType, productTypes, ageGroup, priceMin, priceMax, boostTypes });
  // Only for the exact query the server ran: on "Sau" the visitor can change
  // gender, and a stale first page must not stand in for the new one.
  const initialPage =
    initial && initial.key === JSON.stringify(filters) ? initial.products : undefined;
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInspoProducts(filters, { initialPage });

  const products = (data?.pages.flat() ?? []).map(toCardProduct);

  return (
    <section>
      <h2 className="mb-4 font-heading text-[22px] font-bold leading-tight tracking-[-0.02em] text-(--nr-ink) sm:text-[26px]">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
        {isLoading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i}>
                <div className="nr-skeleton aspect-[4/5] w-full rounded-xl" />
                <div className="nr-skeleton mt-2.5 h-3 w-2/3 rounded" />
                <div className="nr-skeleton mt-2 h-3 w-1/2 rounded" />
              </div>
            ))
          : products.map((p) => (
              <ProductCard key={p.id} product={p} onOpen={() => onOpen(p)} />
            ))}
      </div>
      {hasNextPage && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="min-h-11 cursor-pointer rounded-full border border-(--nr-ink)/15 px-7 text-[15px] font-semibold text-(--nr-ink) transition-colors hover:border-(--nr-ink) disabled:opacity-50"
          >
            {t("firstView.loadMore")}
          </button>
        </div>
      )}
    </section>
  );
}
