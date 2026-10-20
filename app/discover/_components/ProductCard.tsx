"use client";

import { useTranslations } from "next-intl";
import { LuHeart, LuSparkles } from "react-icons/lu";
import { cleanName, formatPrice } from "@/lib/discover/format";

export type CardProduct = {
  id: string;
  title: string;
  brand?: string | null;
  price: number | null;
  /** Recommended retail price. Carried for the modal; the card never shows it. */
  rrp?: number | null;
  /** Percent off vs. rrp (0–100). Surfaced only in the modal. */
  discountPct?: number | null;
  imageUrl: string | null;
  deepLink: string | null;
  /** Present only for AI picks — the concierge's one-line rationale. */
  reason?: string | null;
  /** Extra context surfaced in the modal / used for corrections. */
  productType?: string | null;
  gender?: string | null;
  merchant?: string | null;
  /** Direct-partner products only: opens "more from this shop". */
  partnerId?: string | null;
};

/** Longest edge we ever need for a card, which is ~250px at 2x. */
const CARD_PX = 600;

/**
 * Ask each merchant CDN for a card-sized image.
 *
 * This started life as "bump the AWIN thumbnail" and only rewrote `w=`/`h=`.
 * The TradeDoubler merchants use different parameters, so their originals came
 * through untouched — About You's URLs literally request width=2000&height=2000
 * (370 KB each) and 4F serves 318 KB. Two dozen of those is ~8 MB of images for
 * one screen, which is why cards sat blank for seconds even though every URL
 * returns 200.
 *
 * Each rewrite is a no-op on CDNs that do not use that parameter, so unknown
 * hosts (Modivo, 4F) simply fall through at full size rather than breaking.
 */
function cardImage(url: string): string {
  return url
    .replace(/([?&])w=\d+/, `$1w=${CARD_PX}`)
    .replace(/([?&])h=\d+/, `$1h=${CARD_PX}`)
    // About You
    .replace(/([?&])width=\d+/, `$1width=${CARD_PX}`)
    .replace(/([?&])height=\d+/, `$1height=${CARD_PX}`)
    // Douglas
    .replace(/([?&])imwidth=\d+/, `$1imwidth=${CARD_PX}`);
  // NB no rewrite for Eavalyne/eobuwie (`eob_product_1800w_1800h`): that CDN
  // serves ONLY the exact preset baked into the feed URL and answers every other
  // value with a 14-byte error, so "resizing" it silently breaks 51k images.
  // Modivo is left alone for the same reason — its URLs carry no size token.
}

/**
 * The discover product card, "one studio" (20 Oct redesign).
 *
 * No frame, no shadow, no lift: the packshot IS the card. Every image sits on
 * the same stone tone (--nr-stage) and is multiplied into it, so the white
 * backgrounds of 15 different shops disappear and the catalogue reads as one
 * shoot. That consistency is what makes a feed of affiliate products feel
 * curated rather than scraped.
 *
 * The whole card opens the detail modal — save / view / report live there.
 */
export function ProductCard({
  product,
  onOpen,
}: {
  product: CardProduct;
  onOpen: () => void;
}) {
  const t = useTranslations("Inspo");

  // No discount treatment on the card — no badge, no red price, no struck-through
  // rrp. This is a gift-inspiration surface, not a shop: a wall of "-40%" reads
  // as a bargain bin and cheapens the thing being suggested. The saving still
  // matters, just later — ProductModal shows it at the point someone is actually
  // deciding to buy.

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex h-full cursor-pointer flex-col rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-(--nr-ink) focus-visible:ring-offset-4 focus-visible:ring-offset-(--nr-cream)"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-(--nr-stage)">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl ? cardImage(product.imageUrl) : "/assets/placeholder.jpg"}
          alt={product.title}
          className="h-full w-full object-contain p-[9%] mix-blend-multiply transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04]"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.src = "/assets/placeholder.jpg";
          }}
        />

        {product.reason ? (
          <span
            className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-(--nr-yellow) text-(--nr-ink)"
            aria-hidden
          >
            <LuSparkles className="w-3.5" />
          </span>
        ) : null}

        {/* Wishlist affordance — opens the modal where boards are chosen. The
            visible circle is 32px; the padding makes the target 44px. */}
        <button
          type="button"
          aria-label={t("addToBoard")}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="absolute right-0 top-0 cursor-pointer p-1.5"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-(--nr-ink) transition-colors hover:bg-(--nr-yellow)">
            <LuHeart className="w-4" />
          </span>
        </button>
      </div>

      <div className="flex flex-1 flex-col pt-2.5">
        {product.brand && (
          <span className="line-clamp-1 text-[13px] font-semibold text-(--nr-ink)">
            {product.brand}
          </span>
        )}
        <h3 className="line-clamp-2 text-[13px] leading-[1.35] text-(--nr-muted)">
          {cleanName(product.title, product.brand)}
        </h3>
        <span className="mt-1 text-[14px] font-semibold tabular-nums text-(--nr-ink)">
          {formatPrice(product.price)}
        </span>
      </div>
    </div>
  );
}
