"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LuSearch } from "react-icons/lu";
import type { VisitorGender } from "@/lib/discover/recipients";
import {
  NAV_RECIPIENTS,
  categoriesFor,
  categoryFromSlug,
  discoverHref,
  recipientFromSlug,
} from "@/lib/discover/routes";

/**
 * The sticky discover bar: recipient tabs, and under them the categories of
 * the chosen recipient. Every item is a link, so Back, sharing and indexing
 * all work (decided 20 Oct). It lives in the discover layout, so it persists
 * across navigations and the underline can slide to the new tab instead of
 * the whole bar re-rendering.
 */
export function DiscoverNav({ gender }: { gender: VisitorGender }) {
  const t = useTranslations("Discover");
  const pathname = usePathname() ?? "";
  const [, root, seg1, seg2] = pathname.split("/");

  const hidden = root !== "discover" || seg1 === "browse" || seg1 === "shop";
  const recipient = seg1 ? recipientFromSlug(seg1) : null;
  const category = recipient && seg2 ? categoryFromSlug(seg2) : null;

  const tabsRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);

  // Measure the active tab for the sliding underline. Layout effect, so the
  // bar is placed before paint and never flashes at the old position.
  useLayoutEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el) {
      setBar(null);
      return;
    }
    setBar({ x: el.offsetLeft, w: el.offsetWidth });
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [recipient, hidden]);

  if (hidden) return null;

  const cats = recipient ? categoriesFor(recipient, gender) : [];

  return (
    <div className="sticky top-0 z-30 border-b border-(--nr-border) bg-(--nr-cream)/92 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <nav
          aria-label={t("hub.recipientsNav")}
          className="relative min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          // Fade the trailing edge so a cut-off tab reads as "scrolls", not "broken".
          style={{ maskImage: "linear-gradient(to right, #000 calc(100% - 32px), transparent)" }}
        >
          <div ref={tabsRef} className="relative flex gap-6">
            {NAV_RECIPIENTS.map((key) => {
              const on = key === recipient;
              return (
                <Link
                  key={key}
                  href={discoverHref(key)}
                  aria-current={on ? "page" : undefined}
                  className={`whitespace-nowrap pb-1.5 pt-4 text-[15px] font-semibold transition-colors ${
                    on ? "text-(--nr-ink)" : "text-(--nr-muted) hover:text-(--nr-ink)"
                  }`}
                >
                  {t(`recipient.${key}`)}
                </Link>
              );
            })}
            {bar && (
              <span
                aria-hidden
                className="absolute bottom-0 left-0 h-[2px] rounded-full bg-(--nr-ink) motion-safe:transition-[transform,width] motion-safe:duration-300 motion-safe:ease-out"
                style={{ width: bar.w, transform: `translateX(${bar.x}px)` }}
              />
            )}
          </div>
        </nav>
        <Link
          href="/idejos/visos"
          aria-label={t("searchPlaceholder")}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-(--nr-ink) transition-colors hover:bg-(--nr-stage)"
        >
          <LuSearch className="w-[18px]" />
        </Link>
      </div>

      {recipient && (
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
          <nav
            aria-label={t("hub.categoriesNav")}
            className="-mx-4 flex gap-5 overflow-x-auto px-4 pb-3 pt-3 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            <Link
              href={discoverHref(recipient)}
              aria-current={!category ? "page" : undefined}
              className={`whitespace-nowrap text-[14px] transition-colors ${
                !category ? "font-semibold text-(--nr-ink)" : "text-(--nr-muted) hover:text-(--nr-ink)"
              }`}
            >
              {t("hub.everything")}
            </Link>
            {cats.map((c) => {
              const on = c === category;
              return (
                <Link
                  key={c}
                  href={discoverHref(recipient, c)}
                  aria-current={on ? "page" : undefined}
                  className={`whitespace-nowrap text-[14px] transition-colors ${
                    on ? "font-semibold text-(--nr-ink)" : "text-(--nr-muted) hover:text-(--nr-ink)"
                  }`}
                >
                  {t(`category.${c}`)}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
