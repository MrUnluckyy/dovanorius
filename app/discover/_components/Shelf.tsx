"use client";

import { useTranslations } from "next-intl";
import { useInspoShelf } from "@/hooks/useInspoShelf";
import type { Audience } from "@/types/inspo";
import { toCardProduct } from "./CollectionRow";
import type { CardProduct } from "./ProductCard";
import { ProductStrip } from "./ProductStrip";
import type { ShelfDef } from "./shelves";

/**
 * One editorial shelf. Renders nothing when its query comes back short — a
 * half-empty shelf reads as broken, and with a quality floor applied some
 * categories legitimately have too little to show.
 */
const MIN_ITEMS = 4;

export function Shelf({
  shelf,
  audience,
  onOpen,
  onSeeAll,
}: {
  shelf: ShelfDef;
  audience: Audience;
  onOpen: (p: CardProduct) => void;
  onSeeAll: (s: ShelfDef) => void;
}) {
  const t = useTranslations("Discover");
  const { data, isLoading } = useInspoShelf(shelf.key, shelf.query, audience);

  const items = (data ?? []).map(toCardProduct);
  if (!isLoading && items.length < MIN_ITEMS) return null;

  return (
    <ProductStrip
      title={t(`shelves.${shelf.key}.title`)}
      subtitle={t(`shelves.${shelf.key}.subtitle`)}
      Icon={shelf.Icon}
      items={items}
      isLoading={isLoading}
      onOpen={onOpen}
      onSeeAll={() => onSeeAll(shelf)}
    />
  );
}
