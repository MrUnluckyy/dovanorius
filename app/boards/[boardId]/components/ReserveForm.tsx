"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { enUS, lt } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LuCalendarCheck, LuCircleCheck, LuShieldCheck } from "react-icons/lu";
import { holdExpiryFrom } from "@/lib/reservationWindow";
import { readRememberedGuestEmail } from "@/hooks/useReserveItem";
import type { Item } from "./WishList";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD = 8;

export type ReserveOutcome = {
  ok: boolean;
  /** Set when the giver also asked for an account and it was created. */
  accountCreated?: boolean;
  /** Set when the account could not be created — the hold still stands. */
  accountError?: "email_taken" | "failed";
};

/**
 * The moment a guest commits to buying a stranger a gift.
 *
 * Renders in two places and must look at home in both: as the body of a
 * standalone dialog (the card's Reserve button) and inline inside the item
 * modal (`variant="inline"`), which is why it does not own a <dialog> itself.
 * Stacking a second modal on top of the item modal read as a mistake.
 *
 * Signing up is offered here but deliberately never redirects. Registration
 * requires email verification, so sending someone to /register mid-reserve
 * means they leave the site with the gift NOT held — the precise thing this
 * whole flow exists to prevent. Instead the gift is reserved first, then the
 * anonymous session is upgraded in place: same auth.uid(), so the reservation
 * carries over with nothing to hand back.
 */
export function ReserveForm({
  item,
  boardName,
  variant = "dialog",
  isPending,
  onConfirm,
  onDone,
}: {
  item: Item;
  boardName?: string | null;
  variant?: "dialog" | "inline";
  isPending: boolean;
  onConfirm: (email: string, password?: string) => Promise<ReserveOutcome>;
  /** Called when the giver dismisses the finished state. */
  onDone: () => void;
}) {
  const t = useTranslations("Boards");
  const locale = useLocale();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [wantsAccount, setWantsAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [outcome, setOutcome] = useState<ReserveOutcome | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // A returning guest shouldn't retype what they gave us last time.
  useEffect(() => {
    setEmail(readRememberedGuestEmail());
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  const emailValid = EMAIL_RE.test(email.trim());
  const passwordValid = !wantsAccount || password.length >= MIN_PASSWORD;
  const canSubmit = emailValid && passwordValid && !isPending;
  const showEmailError = touched && !emailValid;

  // The promise we make up front; the server stamps the authoritative value.
  const expiryLabel = format(holdExpiryFrom(), "PPP", {
    locale: locale === "lt" ? lt : enUS,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    const result = await onConfirm(
      email.trim(),
      wantsAccount ? password : undefined
    );
    // Only linger on success when there's something new to say: an account to
    // confirm, or an account that couldn't be made. A plain hold just closes.
    if (result.ok && (result.accountCreated || result.accountError)) {
      setOutcome(result);
    } else if (result.ok) {
      onDone();
    }
  };

  if (outcome?.ok) {
    return (
      <div className={variant === "dialog" ? "p-6" : "mt-8 border-t border-base-300 pt-6"}>
        <div className="flex items-start gap-3">
          <LuCircleCheck className="text-2xl shrink-0 text-success" aria-hidden />
          <div>
            <p className="font-semibold">{t("reserveDoneTitle")}</p>
            <p className="text-sm text-base-content/70 mt-0.5">
              {t("reservedUntil", { date: expiryLabel })}
            </p>
            <p className="text-sm text-base-content/70 mt-3">
              {outcome.accountCreated
                ? t("reserveAccountCheckEmail", { email: email.trim() })
                : outcome.accountError === "email_taken"
                ? t("reserveAccountTaken")
                : t("reserveAccountFailed")}
            </p>
            {outcome.accountError === "email_taken" && (
              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                className="link link-hover text-sm font-medium inline-block mt-1"
              >
                {t("reserveSignInLink")}
              </Link>
            )}
          </div>
        </div>
        <button className="btn btn-primary w-full mt-5" onClick={onDone}>
          {t("ctaClose")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      {/* Inside the item modal the wish is already on screen in full; repeating
          it here would just push the form below the fold. */}
      {variant === "dialog" && (
        <>
          <div className="flex items-center gap-3 p-6 pb-5">
            <img
              src={item.image_urls?.[0] ?? item.image_url ?? "/assets/placeholder.jpg"}
              alt=""
              aria-hidden
              className="w-14 h-14 rounded-xl object-cover shrink-0 bg-base-200"
              onError={(e) => {
                e.currentTarget.src = "/assets/placeholder.jpg";
              }}
            />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-base-content/50">
                {t("reserveDialogEyebrow")}
              </p>
              <p
                className="font-semibold leading-snug line-clamp-2"
                data-clarity-mask="true"
              >
                {item.title}
              </p>
              {boardName && (
                <p className="text-xs text-base-content/50 truncate">{boardName}</p>
              )}
            </div>
          </div>
          {/* Perforation, like a ticket stub being torn off. */}
          <div className="border-t border-dashed border-base-300" />
        </>
      )}

      {/* The single fact people came back for and did not find: the date. */}
      <div
        className={`flex items-start gap-3 px-6 py-5 bg-base-200/60 ${
          variant === "inline" ? "mt-8 rounded-xl" : ""
        }`}
      >
        <LuCalendarCheck className="text-xl shrink-0 mt-0.5 text-success" aria-hidden />
        <div>
          <p className="text-sm text-base-content/70">{t("reserveHoldLabel")}</p>
          <p className="font-semibold text-lg leading-tight">{expiryLabel}</p>
          <p className="text-xs text-base-content/50 mt-1">{t("reserveHoldHint")}</p>
        </div>
      </div>

      <div className={variant === "dialog" ? "p-6 pt-5" : "pt-5"}>
        <label htmlFor="reserve-email" className="label pt-0 pb-1.5">
          <span className="label-text font-medium">{t("reserveEmailLabel")}</span>
        </label>
        <input
          id="reserve-email"
          ref={inputRef}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          className={`input input-bordered w-full ${showEmailError ? "input-error" : ""}`}
          placeholder={t("reminderPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-describedby="reserve-email-why"
          aria-invalid={showEmailError || undefined}
        />
        {showEmailError && (
          <p className="text-sm text-error mt-1.5" role="alert">
            {t("reserveEmailInvalid")}
          </p>
        )}
        <p
          id="reserve-email-why"
          className="text-sm text-base-content/60 mt-2 leading-relaxed"
        >
          {t("reserveEmailWhy")}
        </p>

        {/* Opt-in account, folded away by default. The gift is reserved either
            way; this only decides whether they get somewhere to manage it. */}
        <div className="mt-4 rounded-xl border border-base-300 p-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm mt-0.5"
              checked={wantsAccount}
              onChange={(e) => setWantsAccount(e.target.checked)}
            />
            <span>
              <span className="font-medium text-sm">{t("reserveAccountToggle")}</span>
              <span className="block text-xs text-base-content/60 leading-relaxed mt-0.5">
                {t("reserveAccountWhy")}
              </span>
            </span>
          </label>

          {wantsAccount && (
            <div className="mt-3">
              <label htmlFor="reserve-password" className="label pt-0 pb-1.5">
                <span className="label-text text-sm">{t("reservePasswordLabel")}</span>
              </label>
              <input
                id="reserve-password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                className="input input-bordered w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="reserve-password-hint"
              />
              <p
                id="reserve-password-hint"
                className="text-xs text-base-content/50 mt-1.5"
              >
                {t("reservePasswordHint", { count: MIN_PASSWORD })}
              </p>
            </div>
          )}
        </div>

        <p className="flex items-start gap-2 text-sm text-base-content/60 mt-3 leading-relaxed">
          <LuShieldCheck className="shrink-0 mt-0.5" aria-hidden />
          <span>{t("reserveEmailPrivacy")}</span>
        </p>

        <button type="submit" className="btn btn-primary w-full mt-5" disabled={!canSubmit}>
          {isPending && <span className="loading loading-spinner loading-xs" />}
          {t("reserveConfirm")}
        </button>
        <p className="text-xs text-center text-base-content/50 mt-2.5">
          {wantsAccount ? t("reserveAccountNote") : t("reserveNoAccount")}
        </p>
        <p className="text-xs text-center mt-2">
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="link link-hover text-base-content/60"
          >
            {t("reserveSignInLink")}
          </Link>
        </p>
      </div>
    </form>
  );
}
