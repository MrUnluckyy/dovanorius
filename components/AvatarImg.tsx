"use client";

import { useState, type ReactNode } from "react";

// An avatar <img> that swaps to `fallback` when the picture can't load:
// missing URL, an expired Google photo, a deleted file, or an iPhone HEIC
// upload (only Safari decodes those). Every avatar on the site should render
// through this so a bad URL never shows as a broken-image icon.
//
// `wrap` puts markup around the image only (e.g. DaisyUI's `.avatar` frame),
// so the fallback isn't nested inside a frame meant for a photo.
export function AvatarImg({
  src,
  fallback,
  wrap,
  alt = "",
  ...rest
}: Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  fallback: ReactNode;
  wrap?: (img: ReactNode) => ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <>{fallback}</>;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      {...rest}
      onError={() => setFailedSrc(src)}
      // A server-rendered image can fail before hydration, when no onError
      // is attached yet; catch that case on mount.
      ref={(el) => {
        if (el?.complete && el.naturalWidth === 0) setFailedSrc(src);
      }}
    />
  );
  return <>{wrap ? wrap(img) : img}</>;
}
