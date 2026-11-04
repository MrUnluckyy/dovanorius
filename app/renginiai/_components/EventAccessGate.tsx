"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LuMailCheck } from "react-icons/lu";
import { loginRedirect } from "@/utils/auth/account";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_AFTER_SECONDS = 60;

/** The "check your inbox" state, also shown after the join form spots a seat. */
export function AccessSent({
  email,
  onChange,
  onResend,
  known = false,
}: {
  email: string;
  onChange: () => void;
  onResend: () => void;
  /** We already told them they are in, so "if you're on the list" would jar. */
  known?: boolean;
}) {
  const t = useTranslations("Events");
  const [wait, setWait] = useState(RESEND_AFTER_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  return (
    <div className="animate-fade-up text-center" role="status">
      <span className="mb-4 inline-grid h-14 w-14 place-items-center rounded-full bg-(--nr-tile) text-(--nr-gold-strong)">
        <LuMailCheck className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="nr-h2 mb-2 text-[22px]">{t("accessSentTitle")}</h2>
      <p className="text-[15px] leading-relaxed text-(--nr-muted)">
        {t.rich(known ? "accessSentBodyKnown" : "accessSentBody", {
          email,
          b: (chunks) => (
            <strong className="text-(--nr-ink) [overflow-wrap:anywhere]">{chunks}</strong>
          ),
        })}
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-(--nr-faint)">
        {t("accessSentHint")}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[14px] font-semibold text-(--nr-gold-strong)">
        <button
          type="button"
          disabled={wait > 0}
          onClick={() => {
            setWait(RESEND_AFTER_SECONDS);
            onResend();
          }}
          className="underline underline-offset-2 disabled:text-(--nr-faint) disabled:no-underline"
        >
          {wait > 0 ? t("accessResendIn", { seconds: wait }) : t("accessResend")}
        </button>
        <button
          type="button"
          onClick={onChange}
          className="underline underline-offset-2"
        >
          {t("accessChangeEmail")}
        </button>
      </div>
    </div>
  );
}

export async function requestAccessLink(
  target: { slug: string } | { token: string },
  email: string
): Promise<boolean> {
  const res = await fetch("/api/events/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...target, email }),
  });
  return res.ok;
}

/**
 * The door back into an event for anyone this device does not recognise.
 *
 * Says nothing about the event itself, and the same thing whether or not the
 * address is on the list, since a private event should not confirm who is in it.
 */
export function EventAccessGate({
  target,
  loginNext,
  title,
  body,
  signedInAs,
}: {
  target: { slug: string } | { token: string };
  loginNext: string;
  title?: string;
  body?: string;
  /** Set when an account is signed in here but has no seat in this event. */
  signedInAs?: string | null;
}) {
  const t = useTranslations("Events");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const valid = EMAIL_RE.test(email.trim());

  const send = async () => {
    setSending(true);
    setFailed(false);
    const ok = await requestAccessLink(target, email.trim()).catch(() => false);
    setSending(false);
    if (ok) setSent(true);
    else setFailed(true);
  };

  if (sent) {
    return (
      <div className="nr-card p-7">
        <AccessSent
          email={email.trim()}
          onChange={() => setSent(false)}
          onResend={send}
        />
      </div>
    );
  }

  return (
    <div className="nr-card animate-fade-up p-7">
      <h1 className="nr-h2 mb-2 text-[24px]">{title ?? t("accessTitle")}</h1>
      <p className="mb-5 text-[15px] leading-relaxed text-(--nr-muted)">
        {body ?? t("accessBody")}
      </p>
      {signedInAs && (
        <p className="mb-5 rounded-[16px] bg-(--nr-tile) px-4 py-3 text-[14px] leading-relaxed text-(--nr-on-yellow-muted)">
          {t("accessSignedInAs", { email: signedInAs })}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !sending) send();
        }}
      >
        <label className="mb-4 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-(--nr-ink)">
            {t("joinEmailLabel")}
          </span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("joinEmailPlaceholder")}
            className="w-full rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-cream) px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-(--nr-faint) focus:border-(--nr-yellow-deep)"
          />
        </label>
        {failed && (
          <p className="mb-3 text-[14px] text-(--nr-danger,#b42318)" role="alert">
            {t("accessFailed")}
          </p>
        )}
        <button
          type="submit"
          disabled={!valid || sending}
          className="nr-btn nr-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? (
            <span className="loading loading-dots loading-md" />
          ) : (
            t("accessCta")
          )}
        </button>
      </form>

      {!signedInAs && (
        <p className="mt-5 text-center text-[14px] text-(--nr-muted)">
          {t("joinHaveAccount")}{" "}
          <Link
            href={loginRedirect(loginNext)}
            className="font-semibold text-(--nr-gold-strong) underline underline-offset-2"
          >
            {t("joinSignIn")}
          </Link>
        </p>
      )}
    </div>
  );
}
