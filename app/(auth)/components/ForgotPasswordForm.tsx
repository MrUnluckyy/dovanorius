"use client";

import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { LuMailCheck } from "react-icons/lu";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const t = useTranslations("Auth");
  const supabase = createClient();

  const emailValid = EMAIL_RE.test(email.trim());
  const showEmailError = touched && !emailValid;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setFormError(null);
    if (!emailValid) return;

    setLoading(true);
    // Through the callback rather than straight to /reset-password: the link
    // comes back with a `code` that has to be exchanged for a session before
    // the form can update anything. Landing on the form directly left it
    // holding an unexchanged code.
    const redirectTo = `${process.env.NEXT_PUBLIC_WEB_URL}/api/auth/callback?next=${encodeURIComponent("/reset-password")}`;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    setLoading(false);

    if (error) {
      // Previously swallowed into console.log, so a rate-limited person saw the
      // button finish and nothing else happen.
      console.error("Password reset request failed:", error);
      setFormError(
        error.status === 429 ? t("errorTooManyRequests") : t("errorGeneric")
      );
      return;
    }

    // Deliberately the same confirmation whether or not the address exists —
    // a different answer would reveal who has an account here.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--nr-tile) text-(--nr-gold-strong)"
        >
          <LuMailCheck size={26} />
        </span>
        <div>
          <h2 className="text-2xl font-semibold font-heading">
            {t("resetSentTitle")}
          </h2>
          <p className="mt-2 text-sm text-base-content/70">
            {t("resetSentBody", { email: email.trim() })}
          </p>
        </div>
        <Link href="/login" className="btn btn-neutral w-full">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-semibold font-heading">
        {t("forgotPasswordTitle")}
      </h2>
      <p className="mt-2 mb-6 text-sm text-base-content/70">
        {t("forgotPasswordLead")}
      </p>

      <form onSubmit={onSubmit} noValidate>
        <fieldset className="fieldset gap-3" disabled={loading}>
          <div className="flex flex-col gap-1">
            <label className="label" htmlFor="reset-email">
              {t("emailLabel")}
            </label>
            <input
              id="reset-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className={`input w-full ${showEmailError ? "input-error" : ""}`}
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={showEmailError || undefined}
            />
            {showEmailError && (
              <p className="text-error text-sm">{t("errorInvalidEmail")}</p>
            )}
          </div>

          {formError && (
            <p className="text-error text-sm" role="alert">
              {formError}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-neutral mt-2"
            data-busy={loading || undefined}
          >
            {t("ctaSendResetLink")}
          </button>

          <Link href="/login" className="link link-hover text-center">
            {t("backToLogin")}
          </Link>
        </fieldset>
      </form>
    </>
  );
}
