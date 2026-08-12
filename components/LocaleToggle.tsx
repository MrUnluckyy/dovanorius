"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { setLocale } from "@/app/actions/action";

const LOCALES = [
  { code: "lt", label: "LT" },
  { code: "en", label: "EN" },
] as const;

/**
 * Language toggle.
 *
 * Replaces a `<select>` of flag emoji. Two problems with that: a lone 🇬🇧 or 🇱🇹
 * is unreadable at a glance — flags are countries, not languages, and English is
 * not the UK — and a select rendered inside the account menu came out as a bare
 * flag with a stray caret, misaligned against the menu rows.
 *
 * With exactly two locales a segmented control is simply the right shape: both
 * options visible, current one obvious, one tap to switch, and no popover to
 * nest inside another popover.
 */
export function LocaleToggle({ className = "" }: { className?: string }) {
  const active = useLocale();
  const [isPending, startTransition] = useTransition();

  const switchTo = (code: string) => {
    if (code === active || isPending) return;
    const formData = new FormData();
    formData.set("locale", code);
    startTransition(async () => {
      await setLocale(formData);
      // The cookie is read on the server; a reload is what makes the new locale
      // take effect across already-rendered segments.
      window.location.reload();
    });
  };

  return (
    <div
      role="group"
      aria-label="Change language"
      className={`inline-flex items-center gap-0.5 p-0.5 ${className}`}
      style={{
        background: "var(--nr-tile)",
        borderRadius: "var(--nr-radius-pill)",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {LOCALES.map((l) => {
        const isActive = active === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => switchTo(l.code)}
            aria-pressed={isActive}
            disabled={isPending}
            className="cursor-pointer px-2.5 py-1 text-xs font-bold tracking-wide transition"
            style={{
              background: isActive ? "var(--nr-ink)" : "transparent",
              color: isActive ? "var(--nr-yellow)" : "var(--nr-muted)",
              borderRadius: "var(--nr-radius-pill)",
            }}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
