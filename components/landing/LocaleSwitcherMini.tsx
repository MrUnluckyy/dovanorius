"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { LuChevronDown } from "react-icons/lu";
import { setLocale } from "@/app/actions/action";

const LOCALES = [
  { code: "lt", flag: "🇱🇹", label: "LT" },
  { code: "en", flag: "🇬🇧", label: "EN" },
] as const;

/**
 * Minimal locale control that matches the nav (ghost, muted → ink), replacing
 * the boxy DaisyUI <select>. A small popover lists the locales; picking one
 * runs the setLocale server action and reloads. Part of the Noriuto design system.
 */
export function LocaleSwitcherMini({
  placement = "down",
}: {
  placement?: "down" | "up";
}) {
  const active = useLocale();
  const current = LOCALES.find((l) => l.code === active) ?? LOCALES[0];
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (code: string) => {
    setOpen(false);
    if (code === active) return;
    const fd = new FormData();
    fd.set("locale", code);
    startTransition(async () => {
      await setLocale(fd);
      window.location.reload();
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        aria-label="Language"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[15px] font-medium text-(--nr-muted) transition-colors hover:bg-(--nr-tile)/60 hover:text-(--nr-ink)"
      >
        <span className="text-[15px] leading-none">{current.flag}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <LuChevronDown
          className="text-[15px] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open && (
        <div
          className={`absolute right-0 z-[60] min-w-[128px] overflow-hidden rounded-2xl border border-(--nr-border) bg-white p-1 shadow-[var(--nr-shadow-float)] ${
            placement === "up"
              ? "bottom-[calc(100%+8px)]"
              : "top-[calc(100%+8px)]"
          }`}
          style={{ animation: "nrFadeUp .18s var(--nr-ease-out-expo) both" }}
        >
          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => pick(l.code)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] transition-colors hover:bg-(--nr-tile)/70 ${
                l.code === active
                  ? "font-bold text-(--nr-ink)"
                  : "font-medium text-(--nr-muted)"
              }`}
            >
              <span className="text-[15px] leading-none">{l.flag}</span>
              <span>{l.label === "LT" ? "Lietuvių" : "English"}</span>
              {l.code === active && (
                <span className="ml-auto text-(--nr-yellow-deep)">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
