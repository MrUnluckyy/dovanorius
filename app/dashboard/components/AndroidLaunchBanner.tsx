"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LuX } from "react-icons/lu";
import { StoreLinks } from "@/components/landing/StoreLinks";
import type { Platform } from "@/lib/device";

/** Read on the server so the banner never flashes in and out on load. */
export const APP_LAUNCH_COOKIE = "nr_app_launch_seen";

/**
 * The Android app is out — told to the people who were asked to test it.
 *
 * This replaces the closed-test recruiting banner that stood in the same slot.
 * Same audience, opposite ask: nothing to sign up for, just a link that works
 * now. Dismissal is a cookie rather than a table, because being told about a
 * release once is not a fact worth a row, and a cookie the server can read
 * keeps the banner from appearing and vanishing mid-render.
 *
 * iPhone readers never see it (decided upstream): their app shipped months ago.
 */
export function AndroidLaunchBanner({ platform }: { platform: Platform }) {
  const t = useTranslations("Dashboard.appLaunch");
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  const markSeen = () => {
    document.cookie = `${APP_LAUNCH_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  };

  const dismiss = () => {
    // Hidden immediately: a close button that waits on anything reads as broken,
    // and there is nothing to roll back if the cookie does not stick.
    setHidden(true);
    markSeen();
  };

  return (
    <div className="relative mb-6 rounded-2xl border border-(--nr-border) bg-(--nr-tile) px-4 py-4 sm:px-5">
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("dismiss")}
        className="btn btn-ghost btn-xs btn-circle absolute right-2 top-2"
      >
        <LuX size={14} />
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        {/* The close button only overlaps the first row, so only that row
            reserves space for it — the store pill gets the full width. */}
        <div className="min-w-0 pr-8">
          <p className="font-semibold text-(--nr-ink)">{t("title")}</p>
          <p className="mt-1 text-sm text-(--nr-muted)">{t("body")}</p>
        </div>
        {/* Following the link is as good as reading the banner, so it stops
            asking — without yanking itself away while the store tab opens. */}
        <div onClick={markSeen} className="shrink-0">
          <StoreLinks platform={platform} />
        </div>
      </div>
    </div>
  );
}
