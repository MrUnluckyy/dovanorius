"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LuCookie, LuX } from "react-icons/lu";
import {
  OPEN_CONSENT_EVENT,
  saveConsent,
  type Consent,
} from "@/lib/consent";

/**
 * Our cookie banner and settings (replaces CookieYes).
 *
 * The banner asks once: "Allow all" and "Necessary only" are the same size and
 * weight, because refusing must be as easy as agreeing. "Choose" opens the
 * settings with one switch per category, nothing pre-ticked. The settings
 * open again from any "Slapukų nustatymai" link (openConsentSettings), since
 * withdrawing must be as easy as giving.
 *
 * The banner does not block the page: people can read first and decide later.
 */
export function ConsentBanner({ initial }: { initial: Consent | null }) {
  const t = useTranslations("Consent");
  const [consent, setConsent] = useState<Consent | null>(initial);
  const [panelOpen, setPanelOpen] = useState(false);
  const [analytics, setAnalytics] = useState(initial?.analytics ?? false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const open = () => {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setPanelOpen(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, open);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, open);
  }, []);

  // Settings is a real dialog: focus moves in, Escape closes, focus returns.
  useEffect(() => {
    if (!panelOpen) return;
    // Show what is actually stored, not what was toggled and abandoned.
    setAnalytics(consent?.analytics ?? false);
    panelRef.current?.querySelector<HTMLElement>("input:not([disabled]), button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      returnFocus.current?.focus?.();
    };
  }, [panelOpen, consent]);

  // No advertising tags exist yet, so there is nothing to ask marketing
  // consent for; it stays off until one is added (and CONSENT_VERSION bumped).
  const decide = (choice: { analytics: boolean }) => {
    setConsent(saveConsent({ analytics: choice.analytics, marketing: false }));
    setPanelOpen(false);
  };

  const showBanner = !consent && !panelOpen;

  return (
    <>
      {showBanner && (
        <section
          role="region"
          aria-labelledby="consent-title"
          className="fixed inset-x-0 bottom-0 z-[62] border-t border-(--nr-border) bg-(--nr-surface) px-5 pb-[max(1.1rem,env(safe-area-inset-bottom))] pt-4 shadow-(--nr-shadow-float) sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[420px] sm:rounded-[24px] sm:border sm:pb-5"
          data-testid="consent-banner"
        >
          <div className="flex items-start gap-3">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-(--nr-tile) text-(--nr-ink)"
              aria-hidden
            >
              <LuCookie size={18} />
            </span>
            <div className="min-w-0">
              <h2 id="consent-title" className="nr-h3 text-[16px]">
                {t("title")}
              </h2>
              <p className="mt-1 text-[14px] leading-relaxed text-(--nr-muted)">
                {t.rich("body", {
                  policy: (chunks) => (
                    <Link
                      href="/slapuku-politika"
                      className="font-semibold text-(--nr-ink) underline underline-offset-2"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => decide({ analytics: false })}
              className="nr-btn nr-btn-dark nr-btn-sm"
              data-testid="consent-necessary"
            >
              {t("necessaryOnly")}
            </button>
            <button
              onClick={() => decide({ analytics: true })}
              className="nr-btn nr-btn-dark nr-btn-sm"
              data-testid="consent-all"
            >
              {t("allowAll")}
            </button>
          </div>
          <button
            onClick={() => {
              returnFocus.current = document.activeElement as HTMLElement | null;
              setPanelOpen(true);
            }}
            className="mt-3 w-full text-center text-[13px] font-semibold text-(--nr-gold-strong) underline underline-offset-2"
          >
            {t("choose")}
          </button>
        </section>
      )}

      {panelOpen && (
        <div
          className="fixed inset-0 z-[63] flex items-end justify-center bg-(--nr-ink)/45 sm:items-center sm:p-4"
          onClick={() => setPanelOpen(false)}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="consent-settings-title"
            className="flex max-h-[90svh] w-full flex-col overflow-hidden rounded-t-[28px] bg-(--nr-surface) sm:max-w-[480px] sm:rounded-[24px]"
            onClick={(e) => e.stopPropagation()}
            data-testid="consent-settings"
          >
            <header className="flex items-center gap-3 border-b border-(--nr-border) px-5 py-4">
              <h2 id="consent-settings-title" className="nr-h3 flex-1 text-[19px]">
                {t("settingsTitle")}
              </h2>
              <button
                onClick={() => setPanelOpen(false)}
                aria-label={t("close")}
                className="grid h-8 w-8 place-items-center rounded-full text-(--nr-muted) transition hover:bg-(--nr-tile) hover:text-(--nr-ink)"
              >
                <LuX />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
              <Category
                title={t("necessaryTitle")}
                body={t("necessaryBody")}
                checked
                locked
                lockedLabel={t("alwaysOn")}
              />
              <Category
                title={t("analyticsTitle")}
                body={t("analyticsBody")}
                checked={analytics}
                onChange={setAnalytics}
              />
              <p className="pb-3 pt-1 text-[13px] leading-relaxed text-(--nr-faint)">
                {t.rich("settingsFoot", {
                  policy: (chunks) => (
                    <Link href="/slapuku-politika" className="underline underline-offset-2">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </div>

            <footer className="grid grid-cols-2 gap-2 border-t border-(--nr-border) px-5 pb-[max(1.1rem,env(safe-area-inset-bottom))] pt-3">
              <button
                onClick={() => decide({ analytics })}
                className="nr-btn nr-btn-outline"
                data-testid="consent-save"
              >
                {t("save")}
              </button>
              <button
                onClick={() => decide({ analytics: true })}
                className="nr-btn nr-btn-dark"
              >
                {t("allowAll")}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function Category({
  title,
  body,
  checked,
  onChange,
  locked = false,
  lockedLabel,
}: {
  title: string;
  body: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  locked?: boolean;
  lockedLabel?: string;
}) {
  return (
    <label
      className={`flex items-start gap-4 border-b border-(--nr-border) py-4 last-of-type:border-b-0 ${
        locked ? "" : "cursor-pointer"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-(--nr-ink)">{title}</span>
        <span className="mt-0.5 block text-[14px] leading-relaxed text-(--nr-muted)">{body}</span>
      </span>
      {locked ? (
        <span className="mt-0.5 shrink-0 text-[12px] font-semibold text-(--nr-success-ink)">
          {lockedLabel}
        </span>
      ) : (
        <input
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          className="toggle toggle-sm mt-1 shrink-0"
        />
      )}
    </label>
  );
}
