"use client";

import { useLinkStatus } from "next/link";

/**
 * Instant acknowledgement for a link whose destination is server-rendered.
 *
 * `loading.tsx` only appears once the navigation has begun and the server is
 * working; the gap people notice is the moment *before* that, when the click
 * has landed and nothing on screen has changed yet. `useLinkStatus` reports it.
 *
 * Deliberately NOT a scrim with a spinner on top. Greying out the board you
 * just asked to open hides the one thing you were looking at, to tell you
 * something you already know. A link is also safe to click twice, so there is
 * nothing to block. Instead a ribbon draws along the card's top edge and the
 * board stays fully visible underneath.
 *
 * Must render INSIDE the <Link> it reports on — it reads the nearest enclosing
 * link's transition — and that link needs `relative`.
 */
export function LinkPendingRibbon({
  className = "rounded-t-3xl",
}: {
  /** Match the host card's top corners so the band sits on its edge. */
  className?: string;
}) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className={`nr-ribbon absolute inset-x-0 top-0 z-10 ${className}`}
      aria-hidden
    />
  );
}
