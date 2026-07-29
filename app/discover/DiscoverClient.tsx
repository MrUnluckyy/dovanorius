"use client";

import { useMemo, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { LuSearch, LuWandSparkles } from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { useInspoProducts } from "@/hooks/useInspoProducts";
import { useGiftIdeas } from "@/hooks/useGiftIdeas";
import { useProductFeedback, type Signal } from "@/hooks/useProductFeedback";
import type { Audience, InspoFilters, InspoProduct } from "@/types/inspo";
import { ProductCard, type CardProduct } from "./_components/ProductCard";
import { CategoryTiles, type Category } from "./_components/CategoryTiles";

const CATEGORIES: Category[] = [
  { key: "clothing", type: "clothing", emoji: "👕" },
  { key: "shoes", type: "shoes", emoji: "👟" },
  { key: "beauty", type: "beauty", emoji: "💄" },
  { key: "bag", type: "bag", emoji: "👜" },
  { key: "accessory", type: "accessory", emoji: "🧣" },
];

const OCCASIONS = ["any", "birthday", "christmas", "anniversary"] as const;

const PRICE_BANDS: { key: string; min: number | null; max: number | null }[] = [
  { key: "all", min: null, max: null },
  { key: "under25", min: null, max: 25 },
  { key: "b25to50", min: 25, max: 50 },
  { key: "b50to100", min: 50, max: 100 },
  { key: "over100", min: 100, max: null },
];

export function DiscoverClient() {
  const t = useTranslations("Discover");
  const tInspo = useTranslations("Inspo");

  const [userId, setUserId] = useState<string | null>(null);
  const [occasion, setOccasion] = useState<string>("any");
  const [productType, setProductType] = useState<string | null>(null);
  const [bandKey, setBandKey] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [audience, setAudience] = useState<Audience>("everyone");

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

  // AI picks (signed-in only), constrained by the global price band.
  const {
    data: aiData,
    isLoading: aiLoading,
    isError: aiError,
  } = useGiftIdeas(userId, occasion, band.min, band.max);
  const ideas = aiData?.ideas ?? [];

  // Gender is known from the taste profile → filter the feed automatically,
  // no redundant audience toggle.
  useEffect(() => {
    const g = aiData?.profile?.gender;
    if (g === "male") setAudience("him");
    else if (g === "female") setAudience("her");
  }, [aiData?.profile?.gender]);

  // Relevance feedback (heart / ✕).
  const { feedback, setFeedback } = useProductFeedback(!!userId);
  const react = (id: string) =>
    userId ? (signal: Signal | null) => setFeedback(id, signal) : undefined;

  const filters: InspoFilters = useMemo(
    () => ({
      merchant: null,
      productType,
      priceMin: band.min,
      priceMax: band.max,
      search,
      audience,
      inSeason: true,
    }),
    [productType, band.min, band.max, search, audience]
  );

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInspoProducts(filters);

  const products = data?.pages.flat() ?? [];

  const toCard = (p: InspoProduct): CardProduct => ({
    id: p.id,
    title: p.product_name,
    brand: p.brand_name,
    price: p.price,
    imageUrl: p.image_url,
    deepLink: p.deep_link,
  });

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-10 sm:px-6">
      {/* Editorial header + global price */}
      <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-xl opacity-60">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRICE_BANDS.map((b) => (
            <button
              key={b.key}
              onClick={() => setBandKey(b.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                bandKey === b.key
                  ? "bg-neutral text-neutral-content"
                  : "bg-base-200 hover:bg-base-300"
              }`}
            >
              {t(`price.${b.key}`)}
            </button>
          ))}
        </div>
      </header>

      {/* ===== AI picks ===== */}
      {userId && (
        <section className="mb-12">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-heading text-2xl font-bold tracking-tight">
              <LuWandSparkles className="text-primary" />
              {tInspo("title")}
            </h2>
            <div className="flex flex-wrap gap-1">
              {OCCASIONS.map((o) => (
                <button
                  key={o}
                  onClick={() => setOccasion(o)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    occasion === o
                      ? "bg-primary text-primary-content"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  {tInspo(`occasion.${o}`)}
                </button>
              ))}
            </div>
          </div>

          {aiData?.profile?.summary && (
            <p className="mb-5 max-w-2xl text-sm italic opacity-65">
              “{aiData.profile.summary}”
            </p>
          )}

          {aiError ? (
            <div className="alert alert-warning text-sm">{tInspo("error")}</div>
          ) : aiLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-96 w-full rounded-2xl" />
              ))}
            </div>
          ) : ideas.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {ideas.map((idea) => (
                <ProductCard
                  key={idea.product_id}
                  product={{
                    id: idea.product_id,
                    title: idea.title,
                    price: idea.price,
                    imageUrl: idea.image_url,
                    deepLink: idea.deep_link,
                    reason: idea.reason,
                  }}
                  signal={feedback[idea.product_id]}
                  onReact={react(idea.product_id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm opacity-60">{tInspo("empty")}</p>
          )}
        </section>
      )}

      {/* ===== Category tiles ===== */}
      <section className="mb-10">
        <h2 className="mb-4 font-heading text-2xl font-bold tracking-tight">
          {t("shopByCategory")}
        </h2>
        <CategoryTiles
          categories={CATEGORIES}
          active={productType}
          onSelect={setProductType}
        />
      </section>

      {/* ===== Feed ===== */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-2xl font-bold tracking-tight">
            {productType
              ? t(`category.${CATEGORIES.find((c) => c.type === productType)?.key}`)
              : t("moreForYou")}
          </h2>
          <label className="input input-sm flex w-full items-center gap-2 rounded-full sm:w-72">
            <LuSearch className="w-4 opacity-50" />
            <input
              type="text"
              className="grow"
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </label>
        </div>

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
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={toCard(p)}
                  signal={feedback[p.id]}
                  onReact={react(p.id)}
                />
              ))}
            </div>

            {hasNextPage && (
              <div className="mt-10 flex justify-center">
                <button
                  className="btn btn-neutral btn-wide rounded-full"
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
    </div>
  );
}
