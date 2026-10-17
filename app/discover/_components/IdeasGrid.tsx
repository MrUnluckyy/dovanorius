"use client";

import { useTranslations } from "next-intl";
import { useInspoProducts } from "@/hooks/useInspoProducts";
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
  onOpen,
}: {
  title: string;
  audience: Audience;
  productType: string | null;
  onOpen: (p: CardProduct) => void;
}) {
  const t = useTranslations("Discover");
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInspoProducts({
      merchant: null,
      productType,
      brand: null,
      priceMin: null,
      priceMax: null,
      search: "",
      audience,
      inSeason: true,
      onSaleOnly: false,
      sort: "recommended",
    });

  const products = (data?.pages.flat() ?? []).map(toCardProduct);

  return (
    <section>
      <h2 className="mb-3 font-heading text-xl font-bold tracking-tight">{title}</h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="nr-skeleton aspect-[4/5] w-full rounded-2xl" />
            ))
          : products.map((p) => (
              <ProductCard key={p.id} product={p} onOpen={() => onOpen(p)} />
            ))}
      </div>
      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="btn btn-ghost btn-sm cursor-pointer rounded-full"
          >
            {t("firstView.loadMore")}
          </button>
        </div>
      )}
    </section>
  );
}
