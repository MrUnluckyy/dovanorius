"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { LuX, LuSmartphone, LuCheck } from "react-icons/lu";
import {
  registerTesterInterest,
  dismissTesterPrompt,
} from "@/app/actions/android-testers";

/**
 * A standing ask on the dashboard: help test the Android app.
 *
 * A banner rather than a modal, and an ask rather than a send. Mailing the
 * whole user list would reach the ~75% who never come back, but the privacy
 * policy promises these addresses are not used this way — and a modal over
 * someone's wishlist interrupts the thing they opened the site to do. This
 * costs a dismissal from people it does not apply to and nothing else.
 *
 * Who sees it is decided from the user-agent on the server (see androidUa.ts):
 * iPhones are excluded, desktop is not — a laptop UA says nothing about which
 * phone is in the reader's pocket, and those are exactly the people who say
 * yes. `onAndroid` is the narrower fact: on a device we can see is Android,
 * asking "do you have an Android phone?" is a silly question, so the heading
 * drops it and gets to the point.
 */
export function AndroidTesterBanner({
  defaultEmail,
  onAndroid,
}: {
  defaultEmail: string;
  onAndroid: boolean;
}) {
  const t = useTranslations("AndroidTester");
  const [step, setStep] = useState<"ask" | "form" | "done">("ask");
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();

  if (hidden) return null;

  const dismiss = () => {
    // Hidden immediately: a dismissal that waits on a round-trip reads as a
    // broken button, and there is nothing to roll back if the write fails.
    setHidden(true);
    void dismissTesterPrompt();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await registerTesterInterest(email);
      if (res.ok) setStep("done");
      else setError(res.error === "invalid_email" ? t("invalidEmail") : t("error"));
    });
  };

  return (
    <div className="relative rounded-2xl border border-(--nr-border) bg-(--nr-tile) px-4 py-4 sm:px-5 mb-6">
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("dismiss")}
        className="btn btn-ghost btn-xs btn-circle absolute right-2 top-2"
      >
        <LuX size={14} />
      </button>

      {step === "done" ? (
        <div className="flex items-start gap-3 pr-8">
          <LuCheck className="mt-0.5 shrink-0 text-(--nr-ink)" size={18} />
          <div>
            <p className="font-semibold text-(--nr-ink)">{t("doneTitle")}</p>
            <p className="text-sm text-(--nr-muted) mt-1">{t("doneBody")}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 pr-8">
          <LuSmartphone className="mt-0.5 shrink-0 text-(--nr-ink)" size={18} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-(--nr-ink)">
              {onAndroid ? t("titleOnAndroid") : t("title")}
            </p>
            <p className="text-sm text-(--nr-muted) mt-1">
              {onAndroid ? t("bodyOnAndroid") : t("body")}
            </p>

            {step === "ask" ? (
              <button
                type="button"
                onClick={() => setStep("form")}
                className="btn btn-primary btn-sm mt-3"
              >
                {t("cta")}
              </button>
            ) : (
              <form onSubmit={submit} className="mt-3">
                <label
                  htmlFor="android-tester-email"
                  className="block text-sm font-medium text-(--nr-ink)"
                >
                  {t("emailLabel")}
                </label>
                <p className="text-xs text-(--nr-faint) mt-0.5 mb-2">
                  {t("emailHint")}
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="android-tester-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vardas@gmail.com"
                    className="input input-bordered input-sm w-full sm:max-w-xs"
                  />
                  <button
                    type="submit"
                    disabled={pending}
                    className="btn btn-primary btn-sm"
                  >
                    {pending ? t("submitting") : t("submit")}
                  </button>
                </div>
                {error && (
                  <p className="text-sm text-error mt-2" role="alert">
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
