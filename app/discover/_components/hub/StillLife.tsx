"use client";

import Link from "next/link";

/** Same size rewrite as ProductCard, kept small: stack cards are ~200px. */
function tileImage(url: string): string {
  return url
    .replace(/([?&])w=\d+/, "$1w=400")
    .replace(/([?&])h=\d+/, "$1h=400")
    .replace(/([?&])width=\d+/, "$1width=400")
    .replace(/([?&])height=\d+/, "$1height=400")
    .replace(/([?&])imwidth=\d+/, "$1imwidth=400");
}

/**
 * Where each of the three cards sits, front to back. At rest they overlap like
 * a held stack; on hover the stack lifts and fans out. Literal class strings,
 * so Tailwind can see them. Tailwind v4 only applies hover where a pointer
 * exists, so touch screens never get stuck mid-fan.
 */
const CARD_POS = [
  "left-0 z-30 group-hover:-translate-x-[4%] group-hover:-translate-y-[5%] group-hover:-rotate-[5deg]",
  "left-[26%] z-20 scale-[0.93] group-hover:translate-x-[6%] group-hover:-translate-y-[9%] group-hover:rotate-[1deg]",
  "left-[49%] z-10 scale-[0.86] group-hover:translate-x-[10%] group-hover:-translate-y-[3%] group-hover:rotate-[6deg]",
];

/**
 * Cards fill the tile down to its bottom edge, so the label sits right under
 * them; the spare 8% is on top, where the hover lift goes.
 */
const CARD_BOX = "top-[8%] h-[92%]";

/**
 * A navigation tile: three of the recipient's (or category's) real products
 * as a small stack of white cards, the same "pile of wishes" the app uses for
 * boards. Each product gets its own card, so packshots and lifestyle photos
 * sit together without one pretending to be the other's background.
 *
 * `photo` swaps the stack for a single image once real photography exists.
 */
export function StillLife({
  href,
  label,
  images,
  photo,
  active,
  size = "md",
}: {
  href: string;
  label: string;
  images: string[];
  photo?: string | null;
  active?: boolean;
  size?: "md" | "sm";
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // z-index on hover/focus: a fanned stack spreads over its neighbours
      // instead of sliding under them.
      className="group relative z-0 block rounded-xl outline-none hover:z-20 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-(--nr-ink) focus-visible:ring-offset-4 focus-visible:ring-offset-(--nr-cream)"
    >
      <div className="relative aspect-[13/9]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full rounded-xl object-cover" loading="lazy" />
        ) : (
          CARD_POS.map((pos, i) => {
            const src = images[i];
            return (
              <div
                key={i}
                className={`absolute aspect-[4/5] ${CARD_BOX} ${pos} motion-safe:transition-[translate,rotate] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(.2,.8,.2,1)]`}
              >
                <div className="h-full w-full overflow-hidden rounded-[14px] bg-white shadow-[0_1px_2px_rgba(35,31,24,0.06),0_10px_28px_-14px_rgba(35,31,24,0.35)] ring-1 ring-(--nr-border)">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tileImage(src)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain p-[10%]"
                    />
                  ) : (
                    <div className="nr-skeleton h-full w-full" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <span
        className={`mt-2 block font-semibold text-(--nr-ink) ${size === "md" ? "text-[16px]" : "text-[14px]"}`}
      >
        <span className={active ? "border-b-2 border-(--nr-ink) pb-0.5" : ""}>{label}</span>
      </span>
    </Link>
  );
}
