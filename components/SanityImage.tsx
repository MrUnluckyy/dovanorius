import Image from "next/image";

import { urlFor } from "@/sanity/image";

export type SanityImageValue = {
  alt?: string | null;
  asset?: {
    _id: string;
    url: string;
    metadata?: {
      lqip?: string | null;
      dimensions?: { width: number; height: number } | null;
    } | null;
  } | null;
  hotspot?: unknown;
  crop?: unknown;
};

type Props = {
  value?: SanityImageValue | null;
  /** Rendered width in CSS pixels; drives the size we ask the CDN for. */
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  alt?: string;
};

/**
 * Renders a Sanity image through next/image. Sanity's CDN does the resizing and
 * format negotiation, so this stays separate from the Supabase upload pipeline.
 */
export default function SanityImage({
  value,
  width = 1200,
  height,
  className,
  sizes = "(max-width: 768px) 100vw, 768px",
  priority = false,
  alt,
}: Props) {
  if (!value?.asset) return null;

  const dimensions = value.asset.metadata?.dimensions;
  const ratio = dimensions ? dimensions.width / dimensions.height : 16 / 9;
  const finalHeight = height ?? Math.round(width / ratio);
  const lqip = value.asset.metadata?.lqip ?? undefined;

  return (
    <Image
      className={className}
      src={urlFor(value as never)
        .width(width)
        .height(finalHeight)
        .fit("crop")
        .auto("format")
        .url()}
      alt={alt ?? value.alt ?? ""}
      width={width}
      height={finalHeight}
      sizes={sizes}
      priority={priority}
      placeholder={lqip ? "blur" : "empty"}
      blurDataURL={lqip}
    />
  );
}
