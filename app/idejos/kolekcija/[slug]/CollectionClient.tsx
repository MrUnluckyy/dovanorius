"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  usePersonaPicks,
  useShelfContinuation,
  type GiftPersona,
} from "@/hooks/usePersonas";
import { trackDiscover, trackInspo } from "@/utils/trackInspo";
import { toCardProduct } from "../../_components/CollectionRow";
import { ProductCard, type CardProduct } from "../../_components/ProductCard";
import { ProductModal } from "../../_components/ProductModal";

export function CollectionClient({
  collection,
  accountId,
}: {
  collection: GiftPersona;
  accountId: string | null;
}) {
  const t = useTranslations("Discover");
  const locale = useLocale();
  const [selected, setSelected] = useState<CardProduct | null>(null);

  const isEditorial = collection.kind === "editorial";
  // Hand-ordered shelves keep the curator's order; see usePersonaPicks.
  const { data: picks = [], isLoading } = usePersonaPicks(collection.id, { rotate: !isEditorial });
  const types = Array.from(new Set(picks.map((p) => p.product_type).filter(Boolean) as string[]));
  const { data: more = [] } = useShelfContinuation(
    types,
    picks.map((p) => p.id),
    collection.exclude_keywords ?? [],
    !isEditorial && picks.length > 0
  );

  useEffect(() => {
    trackDiscover("discover_view", { page: "inspire", shelf: collection.slug });
  }, [collection.slug]);

  const open = (surface: string) => (p: CardProduct) => {
    setSelected(p);
    trackInspo("open", p.id, { page: "inspire", surface, shelf: collection.slug });
  };

  const grid = "grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5";

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-6 sm:px-6">
      <header className="pb-8 pt-8 sm:pb-10 sm:pt-12">
        <p className="text-[14px] font-semibold text-(--nr-muted)">{t("hub.collection")}</p>
        <h1 className="mt-1 font-heading text-[34px] font-extrabold leading-[1.02] tracking-[-0.035em] text-(--nr-ink) sm:text-[52px]">
          {locale === "en" ? collection.label_en : collection.label_lt}
        </h1>
        {!isLoading && (
          <p className="mt-3 text-[15px] text-(--nr-muted)">{t("hub.pickCount", { count: picks.length })}</p>
        )}
      </header>

      <div className={grid}>
        {isLoading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="nr-skeleton aspect-[4/5] w-full rounded-xl" />
            ))
          : picks.map((p) => {
              const card = toCardProduct(p);
              return <ProductCard key={p.id} product={card} onOpen={() => open("collection")(card)} />;
            })}
      </div>

      {more.length > 0 && (
        <section className="mt-20">
          <h2 className="font-heading text-[22px] font-bold tracking-[-0.02em] text-(--nr-ink) sm:text-[26px]">
            {t("moreFromCategory")}
          </h2>
          <p className="mb-5 mt-1 text-[14px] text-(--nr-muted)">{t("moreFromCategoryNote")}</p>
          <div className={grid}>
            {more.map((p) => {
              const card = toCardProduct(p);
              return <ProductCard key={p.id} product={card} onOpen={() => open("continuation")(card)} />;
            })}
          </div>
        </section>
      )}

      <ProductModal product={selected} userId={accountId} onClose={() => setSelected(null)} />
    </div>
  );
}
