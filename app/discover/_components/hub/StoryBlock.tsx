"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { trackDiscover } from "@/utils/trackInspo";
import { ProductCard, type CardProduct } from "../ProductCard";

/** What the block shows; built from a gift guide or a sponsored placement. */
export type Story = {
  kind: "guide" | "sponsored";
  /** "Dovanų gidas", or "Remiama · Mideer" — ads must be marked as ads. */
  label: string;
  title: string;
  excerpt: string | null;
  image: string | null;
  imageAlt: string | null;
  href: string;
  ctaLabel: string;
  /** Sponsored placements only: counted in discover_ad_stats. */
  placementId?: string;
};

/**
 * The editorial break in the feed: a large image, a headline, a line of
 * context and the products that belong to it. Guides and sponsored
 * placements share the format, so a partner campaign never looks bolted on;
 * the label is what tells them apart.
 */
export function StoryBlock({
  story,
  products,
  onOpen,
}: {
  story: Story;
  products: CardProduct[];
  onOpen: (p: CardProduct) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const sponsored = story.kind === "sponsored";
  // Never let "20" and "€" land on different lines.
  const nb = (text: string) => text.replace(/(\d) €/g, "$1 €");

  // An ad counts as seen once half of it has been on screen, once per mount.
  useEffect(() => {
    if (!sponsored || !story.placementId || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          trackDiscover("ad_view", { placement: story.placementId });
          io.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [sponsored, story.placementId]);

  const onClick = () => {
    if (sponsored && story.placementId) trackDiscover("ad_click", { placement: story.placementId });
  };

  // Ads leave the site and must say so to search engines; guides are ours.
  const linkProps = sponsored
    ? { target: "_blank", rel: "sponsored noopener noreferrer", onClick }
    : {};

  return (
    <section ref={ref}>
      {/* Image and words side by side, centred on each other; the products
          get their own full-width row. Covers are usually wide graphics, so a
          tall right column beside them left a hole under the image. */}
      <div className="grid gap-5 md:grid-cols-12 md:items-center md:gap-10">
        <Link
          href={story.href}
          {...linkProps}
          className="group block overflow-hidden rounded-xl bg-(--nr-stage-2) md:col-span-7"
        >
          {story.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={story.image}
              alt={story.imageAlt ?? ""}
              loading="lazy"
              // Wide covers (guides, most ads) keep their own proportions; only
              // an image taller than the cap is cropped, from the centre, so a
              // tall upload cannot stretch the block down the page.
              className="max-h-[520px] w-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.02] md:max-h-[440px]"
            />
          ) : (
            <div className="aspect-[16/10]" />
          )}
        </Link>

        <div className="md:col-span-5">
          <p className="text-[14px] font-semibold text-(--nr-muted)">{story.label}</p>
          {/* Quieter than a section title: the cover usually says it already. */}
          <h2 className="mt-1.5 font-heading text-[24px] font-bold leading-[1.15] tracking-[-0.02em] text-(--nr-ink) sm:text-[28px]">
            <Link
              href={story.href}
              {...linkProps}
              className="hover:underline hover:decoration-2 hover:underline-offset-4"
            >
              {nb(story.title)}
            </Link>
          </h2>
          {story.excerpt && (
            <p className="mt-3 line-clamp-3 max-w-[52ch] text-[15px] leading-relaxed text-(--nr-muted)">
              {nb(story.excerpt)}
            </p>
          )}
          <Link
            href={story.href}
            {...linkProps}
            className="mt-4 inline-block text-[14px] font-semibold text-(--nr-ink) underline decoration-(--nr-border) decoration-2 underline-offset-[6px] transition-colors hover:decoration-(--nr-ink)"
          >
            {story.ctaLabel}
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
