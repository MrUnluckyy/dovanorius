"use client";

import { useLocale, useTranslations } from "next-intl";
import { LuSparkles, LuUserRound } from "react-icons/lu";
import { usePersonaPicks, type GiftPersona } from "@/hooks/usePersonas";
import { toCardProduct } from "./CollectionRow";
import type { CardProduct } from "./ProductCard";
import { ProductStrip } from "./ProductStrip";

/**
 * The shelf for whichever recipient the shopper picked.
 *
 * Its picks carry a per-product reason written by the curator, so they render
 * with the same "why this" treatment as the personal AI strip — the difference
 * is this one needs no account.
 */
export function PersonaShelf({
  persona,
  onOpen,
}: {
  persona: GiftPersona;
  onOpen: (p: CardProduct) => void;
}) {
  const t = useTranslations("Discover");
  const locale = useLocale();
  const { data, isLoading } = usePersonaPicks(persona.id);

  const label = locale === "en" ? persona.label_en : persona.label_lt;

  // Persona labels live in the database so they can be edited without a deploy,
  // which is why they are not i18n keys.
  const items: CardProduct[] = (data ?? []).map((p) => ({
    ...toCardProduct(p),
    reason: p.reason,
  }));

  if (!isLoading && items.length === 0) return null;

  return (
    <ProductStrip
      // A theme shelf is its own headline ("Namų jaukumui"); only a recipient
      // shelf reads as "Gifts for <someone>".
      title={
        persona.kind === "theme"
          ? label
          : t("personaShelfTitle", { persona: label })
      }
      subtitle={
        persona.kind === "theme"
          ? t("themeShelfSubtitle")
          : t("personaShelfSubtitle")
      }
      Icon={persona.kind === "theme" ? LuSparkles : LuUserRound}
      items={items}
      isLoading={isLoading}
      onOpen={onOpen}
    />
  );
}
