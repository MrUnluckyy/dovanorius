"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LuX } from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { useInspoProducts } from "@/hooks/useInspoProducts";
import { useDiscoverAudience } from "@/hooks/useDiscoverAudience";
import type { InspoFilters, InspoSort } from "@/types/inspo";
import { ProductCard, type CardProduct } from "../_components/ProductCard";
import { BrowseFilters } from "../_components/BrowseFilters";
import { toCardProduct } from "../_components/CollectionRow";
import { ProductModal } from "../_components/ProductModal";
import { CATEGORIES, PRICE_BANDS, SORTS, AUDIENCES } from "../_components/filters";
import { trackInspo } from "@/utils/trackInspo";

/**
 * The catalogue, as a real page.
 *
 * This was a `mode` boolean inside the discover component, which meant browse
 * had no URL: nothing to share, nothing to bookmark, the back button dropped
 * every filter, and the only way in was one button at the bottom of the page.
 *
 * Filter state lives in the query string now, so `?type=beauty&price=under25`
 * is a link someone can send. Audience is deliberately NOT in the URL — it is a
 * persistent profile setting, and baking it into a shared link would send the
 * recipient your gender preference along with the products.
 */
export function BrowseClient() {
  const t = useTranslations("Discover");
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CardProduct | null>(null);

  // URL is the source of truth; nothing is mirrored into state that the address
  // bar already holds, so back/forward just work.
  const productType = params.get("type");
  const brand = params.get("brand");
  const bandKey = params.get("price") ?? "all";
  const sort = (params.get("sort") as InspoSort) ?? "recommended";
  const onSaleOnly = params.get("sale") === "1";
  const search = params.get("q") ?? "";

  // The one exception: typing should not push a history entry per keystroke.
  const [searchInput, setSearchInput] = useState(search);

  const { audience, setAudience } = useDiscoverAudience(userId);
  const band = PRICE_BANDS.find((b) => b.key === bandKey) ?? PRICE_BANDS[0];

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v == null || v === "" || v === "all") sp.delete(k);
        else sp.set(k, v);
      }
      // replace, not push: adjusting a filter is refining one view rather than
      // navigating, so Back should leave browse instead of walking every tweak.
      router.replace(sp.toString() ? `?${sp}` : "/discover/browse", {
        scroll: false,
      });
    },
    [params, router]
  );

  useEffect(() => {
    const id = setTimeout(() => {
      if (searchInput !== search) setParams({ q: searchInput || null });
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput, search, setParams]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (active && user) setUserId(user.id);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filters: InspoFilters = useMemo(
    () => ({
      merchant: null,
      productType,
      brand,
      priceMin: band.min,
      priceMax: band.max,
      search,
      audience,
      inSeason: true,
      onSaleOnly,
      sort,
    }),
    [productType, brand, band.min, band.max, search, audience, onSaleOnly, sort]
  );

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInspoProducts(filters);
  const products = useMemo(() => data?.pages.flat() ?? [], [data]);

  const openProduct = (p: CardProduct) => {
    setSelected(p);
    trackInspo("open", p.id);
  };

  const hasFilters = !!productType || !!brand || bandKey !== "all" || onSaleOnly || !!search;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6">
      <header className="mb-4">
        <Link
          href="/discover"
          className="mb-2 inline-block cursor-pointer text-sm opacity-60 hover:opacity-100"
        >
          ← {t("backToIdeas")}
        </Link>
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          {t("browseTitle")}
        </h1>
      </header>

      <BrowseFilters
        categories={CATEGORIES}
        productType={productType}
        onProductType={(v) => setParams({ type: v })}
        bands={PRICE_BANDS}
        bandKey={bandKey}
        onBandKey={(v) => setParams({ price: v })}
        brand={brand}
        onBrand={(v) => setParams({ brand: v })}
        onSaleOnly={onSaleOnly}
        audiences={AUDIENCES}
        audience={audience}
        onAudience={setAudience}
        sorts={SORTS}
        sort={sort}
        onSort={(v) => setParams({ sort: v })}
        searchInput={searchInput}
        onSearchInput={setSearchInput}
      />

      {hasFilters && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          {productType && (
            <FilterChip
              label={t(`category.${CATEGORIES.find((c) => c.type === productType)?.key}`)}
              onClear={() => setParams({ type: null })}
            />
          )}
          {brand && <FilterChip label={brand} onClear={() => setParams({ brand: null })} />}
          {bandKey !== "all" && (
            <FilterChip label={t(`price.${bandKey}`)} onClear={() => setParams({ price: null })} />
          )}
          {onSaleOnly && (
            <FilterChip label={t("onSale")} onClear={() => setParams({ sale: null })} />
          )}
          {search && (
            <FilterChip
              label={`“${search}”`}
              onClear={() => { setSearchInput(""); setParams({ q: null }); }}
            />
          )}
          <Link
            href="/discover/browse"
            onClick={() => setSearchInput("")}
            className="ml-1 cursor-pointer text-xs font-medium underline underline-offset-2 opacity-60 hover:opacity-100"
          >
            {t("clearAll")}
          </Link>
        </div>
      )}

      <section>
        {isError ? (
          <div className="alert alert-error">{t("error")}</div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="nr-skeleton h-96 w-full rounded-2xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center opacity-60">{t("empty")}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((p) => {
                const card = toCardProduct(p);
                return <ProductCard key={p.id} product={card} onOpen={() => openProduct(card)} />;
              })}
            </div>

            {hasNextPage && (
              <div className="mt-10 flex justify-center">
                <button
                  className="btn btn-neutral btn-wide cursor-pointer rounded-full"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  data-busy={isFetchingNextPage || undefined}
                >
                  {t("loadMore")}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <p className="mt-14 text-center text-xs opacity-50">{t("affiliateDisclosure")}</p>

      <ProductModal product={selected} userId={userId} onClose={() => setSelected(null)} />
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral py-1 pl-3 pr-1.5 text-xs text-neutral-content">
      <span className="max-w-[160px] truncate">{label}</span>
      <button
        onClick={onClear}
        className="grid h-4 w-4 cursor-pointer place-items-center rounded-full transition hover:bg-neutral-content/20"
        aria-label={`Remove ${label}`}
      >
        <LuX className="w-3" />
      </button>
    </span>
  );
}
