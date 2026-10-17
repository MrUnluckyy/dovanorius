"use client";

import { LuSparkles } from "react-icons/lu";
import { usePersonaPicks, type GiftPersona } from "@/hooks/usePersonas";
import { toCardProduct } from "./CollectionRow";
import { ProductCard, type CardProduct } from "./ProductCard";
import { ProductStrip } from "./ProductStrip";

/**
 * The visitor's own block when shopping "Sau": a strip in state 2 ("Tau gali
 * patikti"), a 4-card block in state 3 ("Atrinkta tau") with the reason it is
 * shown. Picks come from the curated persona for the visitor's gender, so this
 * costs no extra request: every persona's picks arrive in one query.
 */
export function ForYouBlock({
  persona,
  variant,
  title,
  subtitle,
  onOpen,
}: {
  persona: GiftPersona;
  variant: "strip" | "grid4";
  title: string;
  subtitle?: string;
  onOpen: (p: CardProduct) => void;
}) {
  const { data, isLoading } = usePersonaPicks(persona.id);
  const items: CardProduct[] = (data ?? []).map((p) => ({
    ...toCardProduct(p),
    reason: p.reason,
  }));

  if (variant === "strip") {
    return (
      <ProductStrip
        title={title}
        subtitle={subtitle}
        Icon={LuSparkles}
        items={items.slice(0, 12)}
        isLoading={isLoading}
        onOpen={onOpen}
      />
    );
  }

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="rounded-3xl border border-base-300 bg-base-100 p-4 sm:p-5">
      <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-primary-content/70">
        {title}
      </p>
      {subtitle && <p className="mt-1 text-sm opacity-60">{subtitle}</p>}
      <div className="mt-3 grid grid-cols-2 gap-x-2.5 gap-y-4 sm:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="nr-skeleton aspect-[4/5] w-full rounded-2xl" />
            ))
          : items.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} onOpen={() => onOpen(p)} />
            ))}
      </div>
    </section>
  );
}
