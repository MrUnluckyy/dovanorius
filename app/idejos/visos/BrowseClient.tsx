"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LuX, LuExternalLink } from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { searchFilterArgs, useInspoProducts } from "@/hooks/useInspoProducts";
import { useDiscoverAudience } from "@/hooks/useDiscoverAudience";
import type { InspoFilters, InspoSort } from "@/types/inspo";
import { ProductCard, type CardProduct } from "../_components/ProductCard";
import { BrowseFilters } from "../_components/BrowseFilters";
import { toCardProduct } from "../_components/CollectionRow";
import { ProductModal } from "../_components/ProductModal";
import { SearchFallbackView, type SearchFallback } from "../_components/SearchFallback";
import { CATEGORIES, PRICE_BANDS, SORTS, AUDIENCES, priceBand, priceBandLabel } from "../_components/filters";
import { BudgetChips } from "../_components/BudgetChips";
import { parseGiftQuery, stripPrice } from "@/lib/discover/queryIntent";
import { discoverHref, occasionHref } from "@/lib/discover/routes";
import { occasionByKey } from "@/lib/discover/occasions";
import { trackInspo, trackDiscover } from "@/utils/trackInspo";
import { isAccountUser } from "@/utils/auth/account";

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
/** A direct partner's shop page: the catalogue, scoped to one shop. */
export type ShopInfo = {
  name: string;
  slug: string;
  websiteUrl: string | null;
  /** Products currently visible in Discover. */
  count: number;
  /** product_type values the shop actually has — the only categories worth offering. */
  types: string[];
};

export function BrowseClient({ shop }: { shop?: ShopInfo } = {}) {
  const t = useTranslations("Discover");
  const params = useSearchParams();
  const supabase = createClient();

  const basePath = shop ? `/idejos/parduotuve/${shop.slug}` : "/idejos/visos";
  const categories = shop ? CATEGORIES.filter((c) => shop.types.includes(c.type)) : CATEGORIES;

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
  // "kvepalai iki 30 eur" is kvepalai on a 30 € budget; "dovana mamai" is a
  // recipient, not a product. The URL keeps what was typed; this reads it.
  const intent = useMemo(() => parseGiftQuery(search), [search]);
  const searchTerm =
    intent.priceMax || intent.recipient || (intent.occasion && !intent.q) ? intent.q : search;
  // "kalėdinis žaislas" stays a search, with a way to the Christmas page.
  const hintOccasion = intent.occasion ? occasionByKey(intent.occasion) : null;

  // The one exception: typing should not push a history entry per keystroke.
  const [searchInput, setSearchInput] = useState(search);

  const { audience, setAudience } = useDiscoverAudience(userId);
  const effectiveBandKey = intent.priceMax ? `iki${intent.priceMax}` : bandKey;
  const band = priceBand(effectiveBandKey);
  const changeBudget = (key: string) => {
    // A chip replaces a budget typed into the search.
    if (intent.priceMax) {
      const q = stripPrice(searchInput);
      setSearchInput(q);
      setParams({ q: q || null, price: key });
    } else {
      setParams({ price: key });
    }
  };

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v == null || v === "" || v === "all") sp.delete(k);
        else sp.set(k, v);
      }
      // replace, not push: adjusting a filter is refining one view rather than
      // navigating, so Back should leave browse instead of walking every tweak.
      //
      // The History API, not router.replace: the router re-requests the route
      // from the server before useSearchParams updates, so every search waited
      // on a server round trip before its query even started. Next syncs
      // useSearchParams with history.replaceState, with no request at all.
      window.history.replaceState(null, "", sp.toString() ? `?${sp}` : basePath);
    },
    [params, basePath]
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
      // Guests browse; only an account can save. See DiscoverClient.
      if (active && isAccountUser(user)) setUserId(user.id);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filters: InspoFilters = useMemo(
    () => ({
      // Partner rows carry the partner's name as merchant_name (see the
      // partner_product_projection trigger).
      merchant: shop?.name ?? null,
      productType,
      brand,
      priceMin: band.min,
      priceMax: band.max,
      search: searchTerm,
      audience,
      inSeason: true,
      onSaleOnly,
      sort,
    }),
    [shop?.name, productType, brand, band.min, band.max, searchTerm, audience, onSaleOnly, sort]
  );

  const {
    data, isLoading, isError, isPlaceholderData, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInspoProducts(filters);
  // Typed ahead of the debounce, or waiting on the new query: the grid still
  // shows the previous results, so say that it is updating.
  const updating = isPlaceholderData || searchInput.trim() !== search.trim();

  // Once a search has settled on nothing, don't leave an empty page: ask the
  // database for the nearest thing that does exist (search_fallback): the
  // spelling fix (begymo -> begimo), else the query minus the words nothing
  // matched (kayali kvepalai -> kvepalai), else popular gifts. Same filters.
  const noResults =
    !!searchTerm.trim() && !isLoading && !isError && !updating && (data?.pages[0]?.length ?? 0) === 0;
  const { data: fallback } = useQuery({
    queryKey: ["search-fallback", searchTerm, filters],
    enabled: noResults,
    staleTime: Infinity,
    queryFn: async () => {
      const { data: fb, error } = await supabase.rpc("search_fallback", {
        p_q: searchTerm,
        ...searchFilterArgs(filters),
      });
      if (error) throw error;
      return fb as SearchFallback;
    },
  });
  const fallbackFilters: InspoFilters = useMemo(
    () => ({
      ...filters,
      search: fallback?.mode === "popular" ? "" : (fallback?.q ?? ""),
      searchSource: "fallback",
      // Popular means "nothing like it": show the best gifts, not the
      // cheapest or the most discounted.
      sort: fallback?.mode === "popular" ? "recommended" : filters.sort,
    }),
    [filters, fallback]
  );
  const fallbackQuery = useInspoProducts(fallbackFilters, { enabled: noResults && !!fallback });
  const fallbackProducts = useMemo(
    () => fallbackQuery.data?.pages.flat() ?? [],
    [fallbackQuery.data]
  );
  const applyTerm = (term: string) => {
    setSearchInput(term);
    setParams({ q: term });
  };
  const products = useMemo(() => data?.pages.flat() ?? [], [data]);

  const page = shop ? "shop" : "browse";

  const openProduct = (p: CardProduct) => {
    setSelected(p);
    trackInspo("open", p.id, { page, surface: search ? "search" : "grid" });
  };

  // Once per mount: refining filters is the same visit, not a new view.
  useEffect(() => {
    trackDiscover("discover_view", { page, state: "legacy" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasFilters = !!productType || !!brand || effectiveBandKey !== "all" || onSaleOnly || !!search;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6">
      <header className="mb-4">
        <Link
          href="/idejos"
          className="mb-2 inline-block cursor-pointer text-sm opacity-75 hover:opacity-100"
        >
          ← {t("backToIdeas")}
        </Link>
        {shop ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                {shop.name}
              </h1>
              <p className="mt-1 text-sm opacity-75">
                {t("shop.subtitle", { shop: shop.name })} · {t("shop.count", { count: shop.count })}
              </p>
            </div>
            {shop.websiteUrl && (
              <a
                // Through /out so the visit is logged and the shop's link tagged.
                href={`/out?u=${encodeURIComponent(shop.websiteUrl)}&src=shop`}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="btn btn-outline btn-sm cursor-pointer gap-2 rounded-full"
              >
                <LuExternalLink className="w-4" />
                {t("shop.visit")}
              </a>
            )}
          </div>
        ) : (
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            {t("browseTitle")}
          </h1>
        )}
      </header>

      <BrowseFilters
        categories={categories}
        productType={productType}
        onProductType={(v) => setParams({ type: v })}
        bands={PRICE_BANDS}
        bandKey={effectiveBandKey}
        onBandKey={changeBudget}
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
        hideBrand={!!shop}
      />

      <BudgetChips value={effectiveBandKey} onChange={changeBudget} className="mb-4" />

      {(intent.recipient || hintOccasion) && (
        <Link
          href={
            hintOccasion
              ? occasionHref(
                  hintOccasion.slug,
                  intent.recipient && hintOccasion.recipients.includes(intent.recipient) ? intent.recipient : null,
                  effectiveBandKey
                )
              : discoverHref(intent.recipient) + (effectiveBandKey !== "all" ? `?price=${effectiveBandKey}` : "")
          }
          className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-(--nr-border) bg-(--nr-tile) px-4 py-3.5 text-[15px] text-(--nr-ink) transition-colors hover:border-(--nr-ink)/40 sm:px-5"
        >
          <span>
            {t("recipientHint", {
              title: hintOccasion
                ? t(`occasion.${hintOccasion.key}.title`)
                : t("hub.recipientTitle", {
                    recipient: t(`recipient.${intent.recipient}`).toLocaleLowerCase("lt"),
                  }),
            })}
          </span>
          <span aria-hidden className="font-semibold">→</span>
        </Link>
      )}

      {hasFilters && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          {productType && (
            <FilterChip
              label={t(`category.${CATEGORIES.find((c) => c.type === productType)?.key}`)}
              onClear={() => setParams({ type: null })}
            />
          )}
          {brand && <FilterChip label={brand} onClear={() => setParams({ brand: null })} />}
          {effectiveBandKey !== "all" && (
            <FilterChip label={priceBandLabel(t, band)} onClear={() => changeBudget("all")} />
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
            href={basePath}
            onClick={() => setSearchInput("")}
            className="ml-1 cursor-pointer text-xs font-medium underline underline-offset-2 opacity-75 hover:opacity-100"
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
          updating ? (
            <div className="flex justify-center py-20">
              <span className="loading loading-spinner loading-md opacity-60" />
            </div>
          ) : (
            <SearchFallbackView
              search={searchTerm}
              fallback={fallback ?? null}
              loading={!fallback || fallbackQuery.isLoading}
              products={fallbackProducts}
              hasMore={!!fallbackQuery.hasNextPage}
              loadingMore={fallbackQuery.isFetchingNextPage}
              onMore={() => fallbackQuery.fetchNextPage()}
              onOpen={openProduct}
              onApply={applyTerm}
            />
          )
        ) : (
          <>
            <div
              aria-busy={updating || undefined}
              className={`grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ${
                updating ? "opacity-50" : ""
              }`}
            >
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

      <p className="mt-14 text-center text-xs opacity-75">{t("affiliateDisclosure")}</p>

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
