"use client";

import { Analytics } from "@vercel/analytics/next";
import { redactUrlEvent } from "@/lib/analyticsRedact";

/**
 * Vercel Web Analytics, with the page URL redacted before it is sent: shared
 * board, invite, guest access and reservation links carry their token in the
 * path, and auth links in the query (see lib/analyticsRedact.ts). beforeSend
 * is a function, so this has to be a client component; the root layout is a
 * server component.
 */
export function VercelAnalytics() {
  return <Analytics mode="production" beforeSend={redactUrlEvent} />;
}
