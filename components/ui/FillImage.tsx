"use client";
import Image from "next/image";
import { useState } from "react";

// Wish images come from two very different sources:
//   1. Our own Supabase uploads → safe + worthwhile to run through the Next
//      image optimizer (AVIF/WebP + responsive resize).
//   2. Arbitrary retailer URLs users saved from any shop → the optimizer would
//      reject unknown hosts (and proxying arbitrary hosts server-side is an SSRF
//      risk), so we render those as a plain lazy <img>, untouched.
// Both variants fill a `position: relative` parent (matching next/image `fill`).
function isOptimizable(src: string): boolean {
  if (src.startsWith("/")) return true; // local /assets
  try {
    const { hostname } = new URL(src);
    return hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

type Props = {
  src: string;
  alt: string;
  sizes?: string;
  className?: string;
  fallback?: string;
};

export function FillImage({
  src,
  alt,
  sizes,
  className = "",
  fallback = "/assets/placeholder.jpg",
}: Props) {
  const [current, setCurrent] = useState(src);
  const onError = () => {
    if (current !== fallback) setCurrent(fallback);
  };

  if (isOptimizable(current)) {
    return (
      <Image
        src={current}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        onError={onError}
        data-clarity-mask="true"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`absolute inset-0 h-full w-full ${className}`}
      onError={onError}
      data-clarity-mask="true"
    />
  );
}
