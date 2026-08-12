"use client";

import { useMemo, useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  LuSearch,
  LuX,
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
import { BrowseFilters } from "./_components/BrowseFilters";
import { toCardProduct } from "./_components/CollectionRow";
import { Shelf } from "./_components/Shelf";
import { PersonaShelf } from "./_components/PersonaShelf";
import { usePersonas } from "@/hooks/usePersonas";
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
  // Persona labels are DB rows, not i18n keys, so the locale is picked here.
  const locale = useLocale();

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
  /** Which recipient the shopper is buying for; null = no persona chosen. */
  const [personaId, setPersonaId] = useState<string | null>(null);

  const { data: personas } = usePersonas();
  // Recipients are offered in the picker; themes are editorial shelves that
  // render inline, and are gradually replacing the keyword-driven SHELVES.
  const recipients = personas?.filter((p) => p.kind === "recipient") ?? [];
  const themes = personas?.filter((p) => p.kind === "theme") ?? [];
  const activePersona = recipients.find((p) => p.id === personaId) ?? null;

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

        {/* Search stays reachable from the inspire page: someone who arrives
            already knowing what they want should not have to find "browse all"
            first. Submitting carries the query straight into browse, which is
            the only mode with a result grid. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = searchInput.trim();
            if (!q) return;
            setSearch(q);
            setMode("browse");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="mb-5"
        >
          <label className="input flex w-full items-center gap-2 rounded-full sm:max-w-md">
            <LuSearch className="w-4 opacity-50" aria-hidden />
            <input
              type="search"
              className="grow"
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label={t("searchPlaceholder")}
            />
          </label>
        </form>

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

        {/* Recipient personas. Distinct from the audience chips above: audience
            is a broad her/him/everyone lens over every shelf, a persona is a
            specific person ("Paaugliui") with a hand-curated shelf behind it.
            Selecting one also sets the audience, so the themed shelves below
            follow along rather than contradicting the choice. */}
        {!!recipients.length && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium opacity-70">
              {t("personaPrompt")}
            </span>
            {recipients.map((p) => {
              const active = personaId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setPersonaId(active ? null : p.id);
                    if (!active && p.gender) {
                      setAudience(p.gender === "female" ? "her" : "him");
                    }
                  }}
                  aria-pressed={active}
                  className={`cursor-pointer rounded-full px-4 py-1.5 text-sm transition ${
                    active
                      ? "bg-primary text-primary-content"
                      : "bg-base-200 hover:bg-base-300"
                  }`}
                >
                  {locale === "en" ? p.label_en : p.label_lt}
                </button>
              );
            })}
          </div>
        )}

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
            {/* Leads the page when chosen: the shopper just told us exactly who
                this is for, so it outranks both the generic shelves and the
                personal strip (which models the SHOPPER, not the recipient). */}
            {activePersona && (
              <PersonaShelf persona={activePersona} onOpen={openProduct} />
            )}

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

            {/* Curated theme shelves. These replace the keyword shelves one at
                a time — both render for now so the two can be compared. */}
            {themes.map((theme) => (
              <PersonaShelf key={theme.id} persona={theme} onOpen={openProduct} />
            ))}

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

      <BrowseFilters
        categories={CATEGORIES}
        productType={productType}
        onProductType={setProductType}
        bands={PRICE_BANDS}
        bandKey={bandKey}
        onBandKey={setBandKey}
        brand={brand}
        onBrand={setBrand}
        onSaleOnly={onSaleOnly}
        audiences={AUDIENCES}
        audience={audience}
        onAudience={setAudience}
        sorts={SORTS}
        sort={sort}
        onSort={setSort}
        searchInput={searchInput}
        onSearchInput={setSearchInput}
      />

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
