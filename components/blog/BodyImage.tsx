import { stegaClean } from "next-sanity";

import SanityImage, { type SanityImageValue } from "@/components/SanityImage";

export type ImageLayout = "full" | "wide" | "inline" | "left" | "right";

/**
 * Placement classes. The article body is a max-w-3xl column, so "wide" pulls
 * out with negative margins and "full" breaks the container entirely.
 */
const LAYOUT_CLASSES: Record<ImageLayout, string> = {
  full: "relative left-1/2 w-screen -translate-x-1/2",
  wide: "sm:-mx-12 lg:-mx-24",
  inline: "",
  left: "float-left mr-6 mb-4 w-1/2 max-w-[18rem]",
  right: "float-right ml-6 mb-4 w-1/2 max-w-[18rem]",
};

/** Rendered width to request from the Sanity CDN per placement. */
const LAYOUT_WIDTHS: Record<ImageLayout, number> = {
  full: 1920,
  wide: 1400,
  inline: 1200,
  left: 600,
  right: 600,
};

const LAYOUT_SIZES: Record<ImageLayout, string> = {
  full: "100vw",
  wide: "(max-width: 768px) 100vw, 1024px",
  inline: "(max-width: 768px) 100vw, 768px",
  left: "(max-width: 640px) 50vw, 288px",
  right: "(max-width: 640px) 50vw, 288px",
};

export default function BodyImage({
  value,
}: {
  value: {
    image?: SanityImageValue | null;
    alt?: string;
    caption?: string;
    layout?: string;
  };
}) {
  if (!value?.image?.asset) return null;

  // `layout` drives rendering, so it must be stega-cleaned before comparison.
  const cleaned = stegaClean(value.layout) as ImageLayout | undefined;
  const layout: ImageLayout =
    cleaned && cleaned in LAYOUT_CLASSES ? cleaned : "inline";

  const isFloat = layout === "left" || layout === "right";

  return (
    <figure className={`my-8 ${LAYOUT_CLASSES[layout]}`}>
      <SanityImage
        value={value.image}
        alt={value.alt}
        width={LAYOUT_WIDTHS[layout]}
        sizes={LAYOUT_SIZES[layout]}
        className={`h-auto w-full ${layout === "full" ? "" : "rounded-box"}`}
      />
      {value.caption && (
        <figcaption
          className={`mt-2 text-sm opacity-70 ${
            isFloat ? "" : "text-center"
          } ${layout === "full" ? "mx-auto max-w-3xl px-4" : ""}`}
        >
          {value.caption}
        </figcaption>
      )}
    </figure>
  );
}
