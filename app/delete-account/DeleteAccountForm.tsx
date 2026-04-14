"use client";

import { createClient } from "@/utils/supabase/client";
import { deleteUserAction } from "@/app/actions/user/delete";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FiAlertTriangle, FiMail } from "react-icons/fi";

type Step = "email" | "otp" | "done";

export function DeleteAccountForm() {
  const t = useTranslations("DeleteAccount");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) {
        setError(t("errorNoAccount"));
        return;
      }
      setStep("otp");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndDelete(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (verifyError || !data.user) {
        setError(t("errorInvalidCode"));
        return;
      }

      await deleteUserAction(data.user.id);
      setStep("done");
    } catch {
      setError(t("errorDeleting"));
    } finally {
      setLoading(false);
    }
  }

  if (step === "done") {
    return (
      <div className="text-center space-y-3 py-4">
        <p className="font-semibold">{t("accountDeleted")}</p>
        <p className="text-sm text-base-content/60">{t("accountDeletedSub")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div role="alert" className="alert alert-error alert-soft">
        <FiAlertTriangle className="shrink-0 size-5" />
        <div>
          <p className="font-semibold">{t("warningTitle")}</p>
          <p className="text-sm mt-1">{t("warningBody")}</p>
        </div>
      </div>

      {step === "email" && (
        <form onSubmit={sendOtp} className="space-y-4">
          <fieldset className="fieldset">
            <label className="label">{t("emailLabel")}</label>
            <input
              type="email"
              className="input w-full"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </fieldset>
          {error && <p className="text-sm text-error">{error}</p>}
          <button
            type="submit"
            className="btn btn-error w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="loading loading-dots loading-sm" />
            ) : (
              <>
                <FiMail className="size-4" />
                {t("ctaSendCode")}
              </>
            )}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={verifyAndDelete} className="space-y-4">
          <p className="text-sm text-base-content/70">
            {t("otpDescription", { email })}
          </p>
          <fieldset className="fieldset">
            <label className="label">{t("codeLabel")}</label>
            <input
              type="text"
              inputMode="numeric"
              className="input w-full tracking-widest text-center text-lg"
              placeholder="000000"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />
          </fieldset>
          {error && <p className="text-sm text-error">{error}</p>}
          <button
            type="submit"
            className="btn btn-error w-full"
            disabled={loading || otp.length < 6}
          >
            {loading ? (
              <span className="loading loading-dots loading-sm" />
            ) : (
              t("ctaConfirmDelete")
            )}
          </button>
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={() => { setStep("email"); setOtp(""); setError(null); }}
          >
            {t("ctaBack")}
          </button>
        </form>
      )}
    </div>
  );
}
