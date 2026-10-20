"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { StoryArticle } from "@/lib/discover/articles";
import { ProductCard, type CardProduct } from "../ProductCard";

/**
 * The editorial break in the feed: one large image, a headline, a line of
 * context and four products that belong to it. One format for gift guides now
 * and sponsored placements later (which add a "Remiama" label, as EU rules
 * require for ads), so a partner campaign never looks bolted on.
 */
export function StoryBlock({
  article,
  products,
  onOpen,
}: {
  article: StoryArticle;
  products: CardProduct[];
  onOpen: (p: CardProduct) => void;
}) {
  const t = useTranslations("Discover.hub");
  const href = `/blog/${article.slug}`;

  return (
    <section className="grid gap-5 md:grid-cols-12 md:gap-8">
      <Link
        href={href}
        className="group relative block self-start overflow-hidden rounded-xl bg-(--nr-stage-2) md:col-span-6"
      >
        {article.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.image}
            alt={article.imageAlt ?? ""}
            loading="lazy"
            // Covers are often designed graphics with type on them, so they keep
            // their own proportions; a crop would cut the words.
            className="h-auto w-full transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.02]"
          />
        ) : (
          <div className="aspect-[16/10]" />
        )}
      </Link>

      <div className="flex flex-col md:col-span-6 md:py-2">
        <p className="text-[14px] font-semibold text-(--nr-muted)">{t("guide")}</p>
        <h2 className="mt-1.5 max-w-[24ch] font-heading text-[28px] font-bold leading-[1.1] tracking-[-0.025em] text-(--nr-ink) sm:text-[34px]">
          <Link href={href} className="hover:underline hover:decoration-2 hover:underline-offset-4">
            {article.title}
          </Link>
        </h2>
        {article.excerpt && (
          <p className="mt-3 line-clamp-3 max-w-[60ch] text-[15px] leading-relaxed text-(--nr-muted)">
            {article.excerpt}
          </p>
        )}
        <Link
          href={href}
          className="mt-4 w-fit text-[14px] font-semibold text-(--nr-ink) underline decoration-(--nr-border) decoration-2 underline-offset-[6px] transition-colors hover:decoration-(--nr-ink)"
        >
          {t("readGuide")}
        </Link>

        {products.length >= 2 && (
          <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 md:mt-8">
            {products.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} onOpen={() => onOpen(p)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
