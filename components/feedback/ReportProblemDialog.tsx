"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LuCircleCheck, LuX } from "react-icons/lu";
import {
  REPORT_EVENT,
  sendReport,
  type ReportContext,
} from "@/lib/report";

/**
 * "Tell us what happened", opened from any error the app shows.
 *
 * The point is that it does NOT ask someone to diagnose anything. The failure
 * already sent us the reason, the item and the path; what a person can add is
 * what they were trying to do, which no beacon will ever know. So the form is
 * one box and an optional address, and it says up front that we have the
 * technical part.
 *
 * Mounted once in the root layout, driven by a window event, because the
 * errors it answers are raised in hooks and toasts that have nowhere to render.
 */
export function ReportProblemDialog() {
  const t = useTranslations("Feedback");
  const [ctx, setCtx] = useState<ReportContext | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const next = (e as CustomEvent<ReportContext>).detail;
      setCtx(next);
      setEmail(next?.contactEmail ?? "");
      setMessage("");
      setSent(false);
      setFailed(false);
    };
    window.addEventListener(REPORT_EVENT, onOpen);
    return () => window.removeEventListener(REPORT_EVENT, onOpen);
  }, []);

  if (!ctx) return null;

  const close = () => setCtx(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setFailed(false);
    const ok = await sendReport({
      area: ctx.area,
      reason: ctx.reason,
      message: message.trim(),
      contactEmail: email.trim() || undefined,
      detail: ctx.detail,
    });
    setSending(false);
    if (ok) setSent(true);
    else setFailed(true);
  };

  return (
    <dialog open className="modal modal-bottom sm:modal-middle">
      <div className="modal-box max-w-md">
        <button
          type="button"
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={close}
          aria-label={t("close")}
        >
          <LuX />
        </button>

        {sent ? (
          <div className="flex items-start gap-3 py-2">
            <LuCircleCheck className="mt-0.5 shrink-0 text-2xl text-success" aria-hidden />
            <div>
              <p className="font-semibold">{t("thanksTitle")}</p>
              <p className="mt-1 text-sm text-base-content/70">
                {email.trim() ? t("thanksWithEmail") : t("thanksBody")}
              </p>
              <button className="btn btn-primary mt-5 w-full" onClick={close}>
                {t("close")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3 className="text-lg font-semibold">{t("title")}</h3>
            <p className="mt-1 text-sm text-base-content/60 leading-relaxed">
              {t("lead")}
            </p>

            <label htmlFor="report-message" className="label pb-1.5 pt-4">
              <span className="label-text font-medium">{t("messageLabel")}</span>
            </label>
            <textarea
              id="report-message"
              className="textarea textarea-bordered w-full"
              rows={4}
              autoFocus
              required
              maxLength={2000}
              placeholder={t("messagePlaceholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <label htmlFor="report-email" className="label pb-1.5 pt-3">
              <span className="label-text font-medium">{t("emailLabel")}</span>
            </label>
            <input
              id="report-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="input input-bordered w-full"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="report-email-why"
            />
            <p id="report-email-why" className="mt-1.5 text-xs text-base-content/50">
              {t("emailWhy")}
            </p>

            {failed && (
              <p className="mt-3 text-sm text-error" role="alert">
                {t("sendFailed")}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary mt-5 w-full"
              disabled={!message.trim() || sending}
              data-busy={sending || undefined}
            >
              {t("send")}
            </button>
          </form>
        )}
      </div>
      <div className="modal-backdrop bg-black/40" onClick={close}>
        <button type="button">{t("close")}</button>
      </div>
    </dialog>
  );
}
