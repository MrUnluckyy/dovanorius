"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report";

/**
 * Files a report when someone lands on the 404 page, so a broken link reaches
 * /admin/reports and the hourly digest instead of going unnoticed.
 *
 * The reason says where the visitor came from, which is what decides the fix:
 * - "internal_link": one of our own pages links here — a bug to fix in code.
 * - "external_link": another site, or an old email, links here — usually a
 *   missing redirect (lib/legacyRoutes.ts).
 * - "direct": typed, bookmarked, or the referrer was stripped.
 *
 * Client-side on purpose: crawlers probing /wp-login.php and the like don't
 * run scripts, so they never reach the table. Once per path per tab session,
 * so a reload doesn't file it twice.
 */
export function NotFoundBeacon() {
  useEffect(() => {
    const { pathname, search } = window.location;
    const key = `nr-404:${pathname}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: report anyway, a duplicate beats silence.
    }

    let reason = "direct";
    let referrer: string | null = null;
    if (document.referrer) {
      try {
        const ref = new URL(document.referrer);
        const internal = ref.origin === window.location.origin;
        reason = internal ? "internal_link" : "external_link";
        // Our own pages in full (that is the page to fix); other sites
        // without their query string, which can carry someone's details.
        referrer = internal ? ref.pathname + ref.search : ref.origin + ref.pathname;
      } catch {
        // Unparseable referrer: leave it as direct.
      }
    }

    reportError({
      area: "not_found",
      reason,
      detail: { search: search || null, referrer },
    });
  }, []);

  return null;
}
