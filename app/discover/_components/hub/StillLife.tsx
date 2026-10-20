"use client";

import Link from "next/link";

/** Same size rewrite as ProductCard, kept small: tiles are ~180px wide. */
function tileImage(url: string): string {
  return url
    .replace(/([?&])w=\d+/, "$1w=400")
    .replace(/([?&])h=\d+/, "$1h=400")
    .replace(/([?&])width=\d+/, "$1width=400")
    .replace(/([?&])height=\d+/, "$1height=400")
    .replace(/([?&])imwidth=\d+/, "$1imwidth=400");
}

/**
 * A navigation tile drawn from real products: three packshots composed as a
 * still life on the studio tone, label underneath. Stands in for photography
 * (decided 20 Oct) and stays current by itself, because the products are the
 * recipient's own curated picks. `photo` replaces the composition once real
 * photography exists.
 */
export function StillLife({
  href,
  label,
  images,
  photo,
  active,
  size = "md",
  single = false,
}: {
  href: string;
  label: string;
  images: string[];
  photo?: string | null;
  active?: boolean;
  size?: "md" | "sm";
  /** One full-bleed image instead of a composition: for apparel, whose model
   *  photos carry their own backgrounds and would look pasted in a collage. */
  single?: boolean;
}) {
  const [a, b, c] = images;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-(--nr-ink) focus-visible:ring-offset-4 focus-visible:ring-offset-(--nr-cream)"
    >
      <div
        className={`relative overflow-hidden rounded-xl bg-(--nr-stage-2) ${
          size === "md" ? "aspect-[4/5]" : "aspect-square"
        }`}
      >
        {photo || (single && a) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo ?? tileImage(a)}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03] ${photo ? "" : "mix-blend-multiply"}`}
          />
        ) : (
          <div className="absolute inset-0 transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]">
            {/* Back left, back right, front centre: a table-top arrangement,
                not a grid, so it reads as composed rather than tiled. */}
            {b && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tileImage(b)} alt="" loading="lazy" className="absolute left-[4%] top-[8%] h-[52%] w-[52%] object-contain mix-blend-multiply" />
            )}
            {c && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tileImage(c)} alt="" loading="lazy" className="absolute right-[4%] top-[14%] h-[46%] w-[46%] object-contain mix-blend-multiply" />
            )}
            {a && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tileImage(a)} alt="" loading="lazy" className="absolute bottom-[5%] left-1/2 h-[56%] w-[60%] -translate-x-1/2 object-contain mix-blend-multiply" />
            )}
          </div>
        )}
      </div>
      <span
        className={`mt-2.5 block font-semibold text-(--nr-ink) ${size === "md" ? "text-[15px]" : "text-[14px]"}`}
      >
        <span className={active ? "border-b-2 border-(--nr-ink) pb-0.5" : ""}>{label}</span>
      </span>
    </Link>
  );
}
