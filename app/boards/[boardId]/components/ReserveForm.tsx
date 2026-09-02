"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LuCalendarCheck,
  LuCircleCheck,
  LuLogIn,
  LuShieldCheck,
} from "react-icons/lu";
import { readRememberedGuestEmail } from "@/hooks/useReserveItem";
import type { Item } from "./WishList";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD = 8;

/**
 * Whether this visit has already been asked to sign in. Deliberately
 * sessionStorage, not localStorage: someone who chose "guest" once should not
 * be asked again while reserving three more gifts, but the next visit is a
 * fresh chance to catch an account holder who never noticed they were signed
 * out. That is the whole failure this gate exists for.
 */
const SIGNIN_PROMPT_KEY = "noriuto_reserve_signin_prompted";

function alreadyPrompted(): boolean {
  try {
    return window.sessionStorage.getItem(SIGNIN_PROMPT_KEY) === "1";
  } catch {
    return false; // private mode / storage disabled: ask, it is not harmful
  }
}

function markPrompted() {
  try {
    window.sessionStorage.setItem(SIGNIN_PROMPT_KEY, "1");
  } catch {
    // Re-asking is a smaller cost than failing a reservation over storage.
  }
}

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
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [wantsAccount, setWantsAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [outcome, setOutcome] = useState<ReserveOutcome | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Sign in, or go on as a guest — asked once per visit, before the email
  // field rather than around it. This form only ever mounts after a click, so
  // reading storage during the first render cannot mismatch a server render.
  const [step, setStep] = useState<"choice" | "form">(() =>
    alreadyPrompted() ? "form" : "choice"
  );

  // A returning guest shouldn't retype what they gave us last time.
  useEffect(() => {
    setEmail(readRememberedGuestEmail());
  }, []);

  // Focus follows the email field into view, whether it was there from the
  // start or arrived when the guest path was chosen.
  useEffect(() => {
    if (step !== "form") return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [step]);

  const continueAsGuest = () => {
    markPrompted();
    setStep("form");
  };

  // Signing in has to come back to the wish they were reserving. Dropping them
  // on the dashboard is how someone leaves without the gift held.
  const loginHref = `/login?next=${encodeURIComponent(`${pathname}?wish=${item.id}`)}`;

  const emailValid = EMAIL_RE.test(email.trim());
  const passwordValid = !wantsAccount || password.length >= MIN_PASSWORD;
  const canSubmit = emailValid && passwordValid && !isPending;
  const showEmailError = touched && !emailValid;

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

  // Inside the item modal the wish is already on screen in full; repeating it
  // there would just push everything below the fold.
  const wishHeader = variant === "dialog" && (
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
  );

  /**
   * The fork, asked before anything else: this is the exact moment an account
   * holder who never noticed they were signed out can still be caught. Both
   * ways out are one tap and neither is hidden — a guest path in small print
   * would just trade misfiled reservations for abandoned ones.
   */
  if (step === "choice") {
    return (
      <div>
        {wishHeader}
        <div className={variant === "dialog" ? "p-6" : "mt-8"}>
          <p className="font-semibold text-lg leading-snug">
            {t("reserveChoiceTitle")}
          </p>
          <p className="text-sm text-base-content/60 mt-1.5 leading-relaxed">
            {t("reserveChoiceBody")}
          </p>
          <Link
            href={loginHref}
            className="btn btn-primary w-full mt-5"
            onClick={markPrompted}
          >
            <LuLogIn aria-hidden />
            {t("reserveSignInCta")}
          </Link>
          <button
            type="button"
            className="btn btn-ghost w-full mt-2"
            onClick={continueAsGuest}
          >
            {t("reserveGuestCta")}
          </button>
          <p className="text-xs text-center text-base-content/50 mt-3">
            {t("reserveChoiceGuestHint")}
          </p>
        </div>
      </div>
    );
  }

  if (outcome?.ok) {
    return (
      <div className={variant === "dialog" ? "p-6" : "mt-8 border-t border-base-300 pt-6"}>
        <div className="flex items-start gap-3">
          <LuCircleCheck className="text-2xl shrink-0 text-success" aria-hidden />
          <div>
            <p className="font-semibold">{t("reserveDoneTitle")}</p>
            <p className="text-sm text-base-content/70 mt-0.5">
              {t("reservedUntil")}
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
                href={loginHref}
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
      {wishHeader}

      {/* The quiet, always-present version of the choice above: on a second
          reserve in the same visit the gate is suppressed, and this is what
          still offers the way into an account. It used to be a text-xs link
          under the fold, below the account checkbox — nobody got that far. */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-6 py-4 ${
          variant === "inline"
            ? "mt-8 rounded-xl border border-base-300"
            : "border-b border-base-300"
        }`}
      >
        <p className="text-sm leading-snug">
          <span className="font-medium">{t("reserveSignInTitle")}</span>
          <span className="block text-base-content/60">
            {t("reserveSignInWhy")}
          </span>
        </p>
        <Link href={loginHref} className="btn btn-sm btn-outline shrink-0">
          <LuLogIn aria-hidden />
          {t("reserveSignInCta")}
        </Link>
      </div>

      {/* The single fact people came back for and did not find: how long the
          hold lasts. It lasts until they end it. */}
      <div
        className={`flex items-start gap-3 px-6 py-5 bg-base-200/60 ${
          variant === "inline" ? "mt-3 rounded-xl" : ""
        }`}
      >
        <LuCalendarCheck className="text-xl shrink-0 mt-0.5 text-success" aria-hidden />
        <div>
          <p className="text-sm text-base-content/70">{t("reserveHoldLabel")}</p>
          <p className="font-semibold text-lg leading-tight">{t("reserveHoldValue")}</p>
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

        <button
          type="submit"
          className="btn btn-primary w-full mt-5"
          disabled={!canSubmit}
          data-busy={isPending || undefined}
        >
          {t("reserveConfirm")}
        </button>
        <p className="text-xs text-center text-base-content/50 mt-2.5">
          {wantsAccount ? t("reserveAccountNote") : t("reserveNoAccount")}
        </p>
      </div>
    </form>
  );
}
