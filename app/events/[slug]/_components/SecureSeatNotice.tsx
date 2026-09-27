"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { LuMail } from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { reportError } from "@/lib/report";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Shown to a participant who is still on an anonymous session.
 *
 * A guest's place in the event lives only in the browser that joined — there
 * is no credential to sign back in with, so clearing site data or picking up a
 * phone loses the seat and, once names are drawn, the name they got.
 * Confirming an address converts the same account to a permanent one, which is
 * the only thing that makes the spot recoverable. It stays on screen until
 * that happens, because until then the risk is real.
 */
export default function SecureSeatNotice({
  knownEmail,
  pendingEmail,
}: {
  knownEmail: string | null;
  /** An address already sent a confirmation link that has not been opened. */
  pendingEmail: string | null;
}) {
  const supabase = createClient();
  const t = useTranslations("Events");
  const [email, setEmail] = useState(pendingEmail ?? knownEmail ?? "");
  const [sending, setSending] = useState(false);
  // A pending address means the link is already in their inbox. Showing the
  // empty form again is what made one guest re-send three times in as many
  // minutes on 2026-09-26 — each attempt spent the project-wide email quota
  // and the last two hit the rate limit.
  const [sent, setSent] = useState(!!pendingEmail);
  const [resent, setResent] = useState(false);

  const reportFailure = (
    error: { code?: string; message: string },
    reason: string,
    value: string
  ) => {
    console.error("Could not secure guest seat:", error);
    reportError({
      area: "auth",
      reason,
      detail: { code: error.code, message: error.message },
      contactEmail: value,
    });
    toast.error(
      error.code === "over_email_send_rate_limit"
        ? t("secureSeatRateLimited")
        : t("secureSeatError")
    );
  };

  const resend = async () => {
    const value = email.trim();
    setSending(true);
    const { error } = await supabase.auth.resend({
      type: "email_change",
      email: value,
    });
    setSending(false);
    if (error) {
      reportFailure(error, "secure_seat_resend_failed", value);
      return;
    }
    // One resend per visit is plenty; a reload brings the button back.
    setResent(true);
  };

  const send = async () => {
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      toast.error(t("inviteInvalidEmail"));
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.updateUser({ email: value });
    setSending(false);
    if (error) {
      // Only an address that genuinely belongs to someone else earns the
      // "already taken" line. Everything else was our fault, and saying it was
      // theirs sends them off to find another address they do not have — which
      // is what happened while the send-email hook was rejecting these.
      const taken =
        error.code === "email_exists" ||
        /already been registered|already registered|already in use/i.test(
          error.message
        );
      if (taken) toast.error(t("joinEmailTaken"));
      else reportFailure(error, "secure_seat_failed", value);
      return;
    }
    setResent(false);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="rounded-[20px] bg-(--nr-success-soft) px-5 py-4 text-[14px] leading-relaxed text-(--nr-success-ink)">
        <p>{t("secureSeatSent", { email: email.trim() })}</p>
        {resent && <p className="mt-1">{t("secureSeatResent")}</p>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold">
          {!resent && (
            <button
              onClick={resend}
              disabled={sending}
              className="underline underline-offset-2 disabled:opacity-50"
            >
              {t("secureSeatResend")}
            </button>
          )}
          <button
            onClick={() => setSent(false)}
            disabled={sending}
            className="underline underline-offset-2 disabled:opacity-50"
          >
            {t("secureSeatChangeEmail")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] bg-(--nr-tile) px-5 py-4">
      <div className="mb-3 flex items-start gap-2.5">
        <LuMail className="mt-0.5 w-4 shrink-0 text-(--nr-gold-strong)" />
        <div>
          <p className="font-heading text-[15px] font-bold text-(--nr-ink)">
            {t("secureSeatTitle")}
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-(--nr-on-yellow-muted)">
            {t("secureSeatBody")}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("joinEmailPlaceholder")}
          className="min-w-0 flex-1 rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-surface) px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-(--nr-faint) focus:border-(--nr-yellow-deep)"
        />
        <button
          onClick={send}
          disabled={sending}
          className="nr-btn nr-btn-dark nr-btn-sm shrink-0 disabled:opacity-50"
        >
          {sending ? t("savingEvent") : t("secureSeatCta")}
        </button>
      </div>
    </div>
  );
}
