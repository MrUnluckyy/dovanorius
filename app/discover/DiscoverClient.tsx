"use client";

import { useMemo, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  LuSearch,
  LuArrowUpDown,
  LuTag,
  LuX,
  LuChevronDown,
  LuShirt,
  LuFootprints,
  LuSparkles,
  LuShoppingBag,
  LuGem,
  LuHouse,
  LuCpu,
  LuBlocks,
  LuWrench,
  LuBike,
  LuCookingPot,
} from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { useInspoProducts } from "@/hooks/useInspoProducts";
import { useGiftIdeas } from "@/hooks/useGiftIdeas";
import { useDiscoverAudience } from "@/hooks/useDiscoverAudience";
import type { Audience, InspoFilters, InspoSort } from "@/types/inspo";
import { ProductCard, type CardProduct } from "./_components/ProductCard";
import { BrandFilter } from "./_components/BrandFilter";
import { toCardProduct } from "./_components/CollectionRow";
import { Shelf } from "./_components/Shelf";
import { SHELVES, shelfToFilters, type ShelfDef } from "./_components/shelves";
import { ProductStrip } from "./_components/ProductStrip";
import { ProductModal } from "./_components/ProductModal";
import { trackInspo } from "@/utils/trackInspo";

// Mirrors the widened product_type taxonomy — the non-fashion buckets were
// unreachable before, which left a third of the catalogue unbrowsable.
const CATEGORIES = [
  { key: "home", type: "home", Icon: LuHouse },
  { key: "beauty", type: "beauty", Icon: LuSparkles },
  { key: "tech", type: "tech", Icon: LuCpu },
  { key: "toys", type: "toys", Icon: LuBlocks },
  { key: "tools", type: "tools", Icon: LuWrench },
  { key: "sport", type: "sport", Icon: LuBike },
  { key: "kitchen", type: "kitchen", Icon: LuCookingPot },
  { key: "clothing", type: "clothing", Icon: LuShirt },
  { key: "shoes", type: "shoes", Icon: LuFootprints },
  { key: "bag", type: "bag", Icon: LuShoppingBag },
  { key: "accessory", type: "accessory", Icon: LuGem },
];

const SORTS: InspoSort[] = ["recommended", "price_asc", "price_desc", "discount"];
const AUDIENCES: Audience[] = ["everyone", "her", "him"];

const PRICE_BANDS: { key: string; min: number | null; max: number | null }[] = [
  { key: "all", min: null, max: null },
  { key: "under25", min: null, max: 25 },
  { key: "b25to50", min: 25, max: 50 },
  { key: "b50to100", min: 50, max: 100 },
  { key: "over100", min: 100, max: null },
];

export function DiscoverClient() {
  const t = useTranslations("Discover");

  const [userId, setUserId] = useState<string | null>(null);
  const [productType, setProductType] = useState<string | null>(null);
  const [bandKey, setBandKey] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [sort, setSort] = useState<InspoSort>("recommended");
  const [selected, setSelected] = useState<CardProduct | null>(null);
  /**
   * "inspire" is the page; "browse" is the old filter-bar + infinite grid, now
   * reached deliberately. Browsing 328k products was never the inspiring part.
   */
  const [mode, setMode] = useState<"inspire" | "browse">("inspire");

  // Audience comes from the profile now (self-declared gender, or the last
  // choice made here) instead of resetting to "everyone" on every visit.
  const { audience, setAudience, resolved: audienceResolved } =
    useDiscoverAudience(userId);

  const supabase = createClient();
  const band = PRICE_BANDS.find((b) => b.key === bandKey) ?? PRICE_BANDS[0];

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;
      setUserId(user.id);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Active filters, for the chip row. Audience is excluded on purpose: it is now
  // a persistent profile setting, not a filter the user just applied.
  const hasFilters =
    !!productType || !!brand || bandKey !== "all" || onSaleOnly || !!search;

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

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInspoProducts(filters);

  // AI "we suggest" strip — only fetched (LLM cost) on the inspire page.
  const { data: aiData, isLoading: aiLoading } = useGiftIdeas(
    mode === "inspire" ? userId : null,
    "any",
    band.min,
    band.max
  );
  const aiIdeas: CardProduct[] = (aiData?.ideas ?? []).map((i) => ({
    id: i.product_id,
    title: i.title,
    price: i.price,
    imageUrl: i.image_url,
    deepLink: i.deep_link,
    reason: i.reason,
  }));

  const products = useMemo(() => data?.pages.flat() ?? [], [data]);

  const openProduct = (p: CardProduct) => {
    setSelected(p);
    trackInspo("open", p.id);
  };

  const clearAll = () => {
    setProductType(null);
    setBrand(null);
    setBandKey("all");
    setOnSaleOnly(false);
    setAudience("everyone");
    setSearchInput("");
    setSearch("");
  };

  /** "See all" on a shelf hands its theme to browse mode. */
  const openShelfInBrowse = (shelf: ShelfDef) => {
    const f = shelfToFilters(shelf);
    clearAll();
    setProductType(f.productType);
    setOnSaleOnly(f.onSaleOnly);
    if (f.priceMax === 25) setBandKey("under25");
    if (f.onSaleOnly) setSort("discount");
    setMode("browse");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ===== Inspire: the page. Shelves with a reason, not a wall of products. =====
  if (mode === "inspire") {
    return (
      <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6">
        <header className="mb-6">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-xl text-sm opacity-60">{t("subtitle")}</p>
        </header>

        {/* Audience — the one control worth showing up front, because it
            changes every shelf below it. Seeded from the profile. */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium opacity-70">
            {t("audiencePrompt")}
          </span>
          {AUDIENCES.map((a) => (
            <button
              key={a}
              onClick={() => setAudience(a)}
              aria-pressed={audience === a}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm transition ${
                audience === a
                  ? "bg-neutral text-neutral-content"
                  : "bg-base-200 hover:bg-base-300"
              }`}
            >
              {t(`audience.${a}`)}
            </button>
          ))}
        </div>

        {/* Wait for the profile before rendering shelves, otherwise every shelf
            loads for "everyone" and then visibly swaps. */}
        {!audienceResolved ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-72 w-full rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {userId && (aiLoading || aiIdeas.length > 0) && (
              <ProductStrip
                title={t("collections.weSuggest")}
                subtitle={t("collections.weSuggestSubtitle")}
                Icon={LuSparkles}
                items={aiIdeas}
                isLoading={aiLoading}
                onOpen={openProduct}
              />
            )}

            {SHELVES.filter(
              (s) => !s.audiences || s.audiences.includes(audience)
            ).map((shelf) => (
              <Shelf
                key={shelf.key}
                shelf={shelf}
                audience={audience}
                onOpen={openProduct}
                onSeeAll={openShelfInBrowse}
              />
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-col items-center gap-2">
          <button
            onClick={() => setMode("browse")}
            className="btn btn-neutral btn-wide cursor-pointer rounded-full"
          >
            {t("browseAll")}
          </button>
          <p className="text-xs opacity-50">{t("browseAllHint")}</p>
        </div>

        <p className="mt-14 text-center text-xs opacity-50">
          {t("affiliateDisclosure")}
        </p>

        <ProductModal
          product={selected}
          userId={userId}
          onClose={() => setSelected(null)}
        />
      </div>
    );
  }

  // ===== Browse: the catalogue, reached on purpose. =====
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6">
      <header className="mb-4">
        <button
          onClick={() => setMode("inspire")}
          className="mb-2 cursor-pointer text-sm opacity-60 hover:opacity-100"
        >
          ← {t("backToIdeas")}
        </button>
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          {t("browseTitle")}
        </h1>
      </header>

      {/* ===== Sticky filter bar ===== */}
      <div className="sticky top-0 z-30 -mx-4 mb-5 border-b border-base-200 bg-base-100/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {/* Row 1: search + audience · sort */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="input input-sm flex grow items-center gap-2 rounded-full sm:max-w-md">
            <LuSearch className="w-4 opacity-50" />
            <input
              type="text"
              className="grow"
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </label>
          <div className="ml-auto flex items-center gap-2">
            <SelectMenu
              value={audience}
              onChange={setAudience}
              alignEnd
              options={AUDIENCES.map((a) => ({
                key: a,
                label: t(`audience.${a}`),
              }))}
            />
            <SelectMenu
              value={sort}
              onChange={setSort}
              alignEnd
              icon={<LuArrowUpDown className="w-3.5 opacity-70" />}
              options={SORTS.map((s) => ({ key: s, label: t(`sort.${s}`) }))}
            />
          </div>
        </div>

        {/* Row 2: category pills | brand · price · sale */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((c) => {
            const isActive = productType === c.type;
            return (
              <button
                key={c.type}
                onClick={() => setProductType(isActive ? null : c.type)}
                aria-pressed={isActive}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                  isActive
                    ? "bg-neutral text-neutral-content"
                    : "bg-base-200 hover:bg-base-300"
                }`}
              >
                <c.Icon className="w-4 shrink-0" aria-hidden />
                {t(`category.${c.key}`)}
              </button>
            );
          })}

          <span className="mx-1 hidden h-5 w-px bg-base-300 sm:block" />

          <BrandFilter value={brand} onSelect={setBrand} />

          <SelectMenu
            value={bandKey}
            onChange={setBandKey}
            options={PRICE_BANDS.map((b) => ({
              key: b.key,
              label: t(`price.${b.key}`),
            }))}
          />

          <button
            onClick={() => setOnSaleOnly((v) => !v)}
            aria-pressed={onSaleOnly}
            className={`btn btn-sm cursor-pointer gap-1.5 rounded-full normal-case ${
              onSaleOnly ? "btn-error" : "btn-ghost bg-base-200"
            }`}
          >
            <LuTag className="w-3.5" />
            {t("onSale")}
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          {audience !== "everyone" && (
            <FilterChip
              label={t(`audience.${audience}`)}
              onClear={() => setAudience("everyone")}
            />
          )}
          {productType && (
            <FilterChip
              label={t(
                `category.${CATEGORIES.find((c) => c.type === productType)?.key}`
              )}
              onClear={() => setProductType(null)}
            />
          )}
          {brand && <FilterChip label={brand} onClear={() => setBrand(null)} />}
          {bandKey !== "all" && (
            <FilterChip
              label={t(`price.${bandKey}`)}
              onClear={() => setBandKey("all")}
            />
          )}
          {onSaleOnly && (
            <FilterChip label={t("onSale")} onClear={() => setOnSaleOnly(false)} />
          )}
          {search && (
            <FilterChip
              label={`“${search}”`}
              onClear={() => {
                setSearchInput("");
                setSearch("");
              }}
            />
          )}
          <button
            onClick={clearAll}
            className="ml-1 cursor-pointer text-xs font-medium underline underline-offset-2 opacity-60 hover:opacity-100"
          >
            {t("clearAll")}
          </button>
        </div>
      )}

      {/* ===== Feed ===== */}
      <section>
        {isError ? (
          <div className="alert alert-error">{t("error")}</div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="skeleton h-96 w-full rounded-2xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center opacity-60">{t("empty")}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((p) => {
                const card = toCardProduct(p);
                return (
                  <ProductCard
                    key={p.id}
                    product={card}
                    onOpen={() => openProduct(card)}
                  />
                );
              })}
            </div>

            {hasNextPage && (
              <div className="mt-10 flex justify-center">
                <button
                  className="btn btn-neutral btn-wide cursor-pointer rounded-full"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage && (
                    <span className="loading loading-spinner loading-sm" />
                  )}
                  {t("loadMore")}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <p className="mt-14 text-center text-xs opacity-50">
        {t("affiliateDisclosure")}
      </p>

      <ProductModal
        product={selected}
        userId={userId}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

/** Compact DaisyUI dropdown used for the sort / price / audience selectors. */
function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  icon,
  alignEnd,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  icon?: React.ReactNode;
  alignEnd?: boolean;
}) {
  const current = options.find((o) => o.key === value) ?? options[0];
  return (
    <div className={`dropdown ${alignEnd ? "dropdown-end" : ""}`}>
      <div
        tabIndex={0}
        role="button"
        className="btn btn-sm cursor-pointer gap-1.5 rounded-full bg-base-200 normal-case"
      >
        {icon}
        {current.label}
        <LuChevronDown className="w-3.5 opacity-70" />
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content menu z-40 mt-1 w-48 rounded-box bg-base-100 p-2 shadow-lg ring-1 ring-base-300"
      >
        {options.map((o) => (
          <li key={o.key}>
            <button
              onClick={() => {
                onChange(o.key);
                (document.activeElement as HTMLElement)?.blur();
              }}
              className={value === o.key ? "active" : ""}
            >
              {o.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
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
