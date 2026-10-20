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
  // Never let "20" and "€" land on different lines.
  const nb = (text: string) => text.replace(/(\d) €/g, "$1\u00a0€");

  return (
    <section>
      {/* Image and words side by side, centred on each other; the products
          get their own full-width row. Covers are usually wide graphics, so a
          tall right column beside them left a hole under the image. */}
      <div className="grid gap-5 md:grid-cols-12 md:items-center md:gap-10">
        <Link
          href={href}
          className="group block overflow-hidden rounded-xl bg-(--nr-stage-2) md:col-span-7"
        >
          {article.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.image}
              alt={article.imageAlt ?? ""}
              loading="lazy"
              // Covers are often designed graphics with type on them, so they
              // keep their own proportions; a crop would cut the words.
              className="h-auto w-full transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.02]"
            />
          ) : (
            <div className="aspect-[16/10]" />
          )}
        </Link>

        <div className="md:col-span-5">
          <p className="text-[14px] font-semibold text-(--nr-muted)">{t("guide")}</p>
          {/* Quieter than a section title: the cover usually says it already. */}
          <h2 className="mt-1.5 font-heading text-[24px] font-bold leading-[1.15] tracking-[-0.02em] text-(--nr-ink) sm:text-[28px]">
            <Link href={href} className="hover:underline hover:decoration-2 hover:underline-offset-4">
              {nb(article.title)}
            </Link>
          </h2>
          {article.excerpt && (
            <p className="mt-3 line-clamp-3 max-w-[52ch] text-[15px] leading-relaxed text-(--nr-muted)">
              {nb(article.excerpt)}
            </p>
          )}
          <Link
            href={href}
            className="mt-4 inline-block text-[14px] font-semibold text-(--nr-ink) underline decoration-(--nr-border) decoration-2 underline-offset-[6px] transition-colors hover:decoration-(--nr-ink)"
          >
            {t("readGuide")}
          </Link>
        </div>
      </div>

      {products.length >= 4 && (
        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-6">
          {products.slice(0, 6).map((p, i) => (
            // Six across on wide screens; four (one clean row) below that.
            <div key={p.id} className={i >= 4 ? "hidden lg:block" : undefined}>
              <ProductCard product={p} onOpen={() => onOpen(p)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
