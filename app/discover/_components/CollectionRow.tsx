"use client";

import { useTranslations } from "next-intl";
import type { IconType } from "react-icons";
import {
  useInspoCollection,
  type CollectionQuery,
} from "@/hooks/useInspoCollection";
import type { InspoProduct } from "@/types/inspo";
import type { CardProduct } from "./ProductCard";
import { ProductStrip } from "./ProductStrip";

export type CollectionDef = {
  /** i18n key under Discover.collections + queryKey seed. */
  key: string;
  Icon?: IconType;
  query: CollectionQuery;
  /** Whether "see all" can map this to the main filter bar. */
  canApply?: boolean;
};

export function toCardProduct(p: InspoProduct): CardProduct {
  return {
    id: p.id,
    title: p.product_name,
    brand: p.brand_name,
    price: p.price,
    rrp: p.rrp,
    discountPct: p.discount_pct,
    imageUrl: p.image_url,
    deepLink: p.deep_link,
    productType: p.product_type,
    gender: p.gender,
    merchant: p.merchant_name,
  };
}

export function CollectionRow({
  collection,
  onOpen,
  onApply,
}: {
  collection: CollectionDef;
  onOpen: (p: CardProduct) => void;
  onApply?: (c: CollectionDef) => void;
}) {
  const t = useTranslations("Discover");
  const { data = [], isLoading } = useInspoCollection(
    collection.key,
    collection.query
  );

  return (
    <ProductStrip
      title={t(`collections.${collection.key}`)}
      Icon={collection.Icon}
      items={data.map(toCardProduct)}
      isLoading={isLoading}
      onOpen={onOpen}
      onSeeAll={
        collection.canApply && onApply ? () => onApply(collection) : undefined
      }
    />
  );
}
