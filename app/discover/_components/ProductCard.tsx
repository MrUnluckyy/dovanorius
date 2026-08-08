"use client";

import { useTranslations } from "next-intl";
import { LuHeart, LuSparkles } from "react-icons/lu";

export type CardProduct = {
  id: string;
  title: string;
  brand?: string | null;
  price: number | null;
  /** Recommended retail price, shown struck-through when discounted. */
  rrp?: number | null;
  /** Percent off vs. rrp (0–100). */
  discountPct?: number | null;
  imageUrl: string | null;
  deepLink: string | null;
  /** Present only for AI picks — the concierge's one-line rationale. */
  reason?: string | null;
  /** Extra context surfaced in the modal / used for corrections. */
  productType?: string | null;
  gender?: string | null;
  merchant?: string | null;
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
 * Premium, uniform product card (Zalando-style). The whole card is clickable
 * and opens the detail modal — save / view / report live there.
 */
export function ProductCard({
  product,
  onOpen,
}: {
  product: CardProduct;
  onOpen: () => void;
}) {
  const t = useTranslations("Inspo");

  const discount =
    product.discountPct != null &&
    product.discountPct >= 5 &&
    product.discountPct <= 85
      ? Math.round(product.discountPct)
      : null;
  const showRrp =
    discount != null && product.rrp != null && product.rrp > (product.price ?? 0);

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
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-base-100 ring-1 ring-base-300/60 transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_50px_-18px_rgba(0,0,0,0.28)] hover:ring-base-300"
    >
      {/* Image */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-white">
        <img
          src={
            product.imageUrl
              ? cardImage(product.imageUrl)
              : "/assets/placeholder.jpg"
          }
          alt={product.title}
          className="h-full w-full object-contain p-3 transition duration-500 group-hover:scale-105"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.src = "/assets/placeholder.jpg";
          }}
        />

        {discount != null && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-error px-2 py-0.5 text-xs font-bold text-error-content shadow-sm">
            -{discount}%
          </span>
        )}

        {product.reason && (
          <span className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-content shadow">
            <LuSparkles className="w-3.5" />
          </span>
        )}

        {/* Wishlist affordance — opens the modal where boards are chosen. */}
        {!product.reason && (
          <button
            type="button"
            aria-label={t("addToBoard")}
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="absolute right-2.5 top-2.5 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-base-100/85 text-base-content opacity-0 shadow-sm backdrop-blur transition hover:bg-base-100 group-hover:opacity-100 max-md:opacity-100"
          >
            <LuHeart className="w-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.brand && (
          <span className="line-clamp-1 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-55">
            {product.brand}
          </span>
        )}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm leading-snug">
          {product.title}
        </h3>

        <div className="mt-auto flex items-baseline gap-1.5 pt-1">
          <span
            className={`text-base font-bold tracking-tight ${
              discount != null ? "text-error" : ""
            }`}
          >
            {product.price != null ? `${product.price} €` : "—"}
          </span>
          {showRrp && (
            <span className="text-xs line-through opacity-40">
              {product.rrp} €
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
