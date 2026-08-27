"use client";

import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { LuCircleCheck, LuTriangleAlert } from "react-icons/lu";
import { ResetPasswordSchema } from "@/schemas/ResetPasswordSchema";

type FormValues = z.infer<typeof ResetPasswordSchema>;

/**
 * The last step of a password reset: the form the emailed link leads to.
 *
 * `updateUser` acts on whatever session the recovery link established, so the
 * only thing this needs to establish is that a session exists. Until it does,
 * submitting would fail with an unhelpful Supabase error, so the form waits.
 */
export default function SetNewPassword() {
  const supabase = createClient();
  const t = useTranslations("Auth");
  const [status, setStatus] = useState<"preparing" | "ready" | "no-session">(
    "preparing"
  );
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onSubmit",
  });

  useEffect(() => {
    let cancelled = false;

    /**
     * Supabase's recovery link hands the session back in the URL *fragment*
     * (`#access_token=...&refresh_token=...`), and a fragment is never sent to
     * a server — so no route handler can see it, and `getSession()` will not
     * find one either.
     *
     * `createBrowserClient` from @supabase/ssr hardcodes `flowType: "pkce"`,
     * which only auto-detects a `?code=` query param. Against an implicit
     * fragment it does nothing at all. That is why every reset ended at
     * "Auth session missing!": the link worked, the session was minted, and
     * the page simply never picked it up. Audit log confirms it — recovery
     * links were being consumed, and `user_updated_password` never followed.
     *
     * So read the fragment ourselves. Handles the current Supabase template;
     * the `?code=` and `token_hash` paths are covered by the route handlers.
     */
    const consumeHash = async (): Promise<boolean> => {
      if (typeof window === "undefined") return false;
      const hash = window.location.hash;
      if (!hash.includes("access_token")) return false;

      const params = new URLSearchParams(hash.slice(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (!access_token || !refresh_token) return false;

      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (error) {
        console.error("Could not restore the recovery session:", error);
        return false;
      }

      // Tokens out of the address bar once they are in the session: they would
      // otherwise sit in history and in anything the browser syncs.
      window.history.replaceState(null, "", window.location.pathname);
      return true;
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        setStatus("ready");
      }
    });

    (async () => {
      const restored = await consumeHash();
      if (cancelled) return;
      if (restored) {
        setStatus("ready");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setStatus(data.session ? "ready" : "no-session");
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const onSubmit = async (values: FormValues) => {
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (error) {
      // Supabase messages here are English and technical ("New password should
      // be different from the old password"), so they are not shown raw.
      console.error("Password update failed:", error);
      setError("root", { message: "errorResetFailed" });
      return;
    }

    setDone(true);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--nr-tile) text-(--nr-gold-strong)"
        >
          <LuCircleCheck size={26} />
        </span>
        <div>
          <h2 className="text-2xl font-semibold font-heading">
            {t("passwordUpdatedTitle")}
          </h2>
          <p className="mt-2 text-sm text-base-content/70">
            {t("passwordUpdatedBody")}
          </p>
        </div>
        <Link href="/login" className="btn btn-neutral w-full">
          {t("ctaLogin")}
        </Link>
      </div>
    );
  }

  if (status === "preparing") {
    return (
      <div
        className="flex items-center justify-center gap-3 py-8"
        aria-live="polite"
      >
        <span className="loading loading-dots loading-md" />
        <span className="text-sm text-base-content/70">
          {t("resetPreparing")}
        </span>
      </div>
    );
  }

  // No session means the link expired, was already used, or was opened in a
  // browser that never had it. Nothing here can recover that — only a new link.
  if (status === "no-session") {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--nr-tile) text-(--nr-gold-strong)"
        >
          <LuTriangleAlert size={26} />
        </span>
        <div>
          <h2 className="text-2xl font-semibold font-heading">
            {t("linkErrorTitle")}
          </h2>
          <p className="mt-2 text-sm text-base-content/70">
            {t("linkErrorLead")}
          </p>
        </div>
        <Link href="/forgot-password" className="btn btn-neutral w-full">
          {t("linkErrorRetry")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-semibold font-heading">
        {t("newPasswordTitle")}
      </h2>
      <p className="mt-2 mb-6 text-sm text-base-content/70">
        {t("newPasswordLead")}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset className="fieldset gap-3" disabled={isSubmitting}>
          <div className="flex flex-col gap-1">
            <label className="label" htmlFor="password">
              {t("newPasswordLabel")}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className={`input w-full ${errors.password ? "input-error" : ""}`}
              placeholder={t("newPasswordLabel")}
              aria-invalid={!!errors.password || undefined}
              {...register("password")}
            />
            {errors.password?.message && (
              <p className="text-error text-sm">{t(errors.password.message)}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="label" htmlFor="confirmPassword">
              {t("confirmPasswordLabel")}
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className={`input w-full ${
                errors.confirmPassword ? "input-error" : ""
              }`}
              placeholder={t("confirmPasswordLabel")}
              aria-invalid={!!errors.confirmPassword || undefined}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword?.message && (
              <p className="text-error text-sm">
                {t(errors.confirmPassword.message)}
              </p>
            )}
          </div>

          {errors.root?.message && (
            <p className="text-error text-sm" role="alert">
              {t(errors.root.message)}
            </p>
          )}

          <button type="submit" className="btn btn-neutral mt-4">
            {isSubmitting ? (
              <span className="loading loading-dots loading-md" />
            ) : (
              t("ctaSetPassword")
            )}
          </button>
        </fieldset>
      </form>
    </>
  );
}
