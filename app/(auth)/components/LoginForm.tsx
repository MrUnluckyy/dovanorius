"use client";
import { createClient } from "@/utils/supabase/client";
import {
  claimGuestReservations,
  withClaimedParam,
} from "@/lib/claimGuestReservations";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { FaGoogle } from "react-icons/fa6";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  /**
   * Set once a redirect is on its way. `finally` used to clear `loading`
   * before the browser had actually left the page, re-enabling the button for
   * the second or two the navigation takes — long enough to sign in twice and
   * fire the claim RPC twice. A ref, not state: `finally` reads it in the same
   * tick, before any re-render.
   */
  const navigatingRef = useRef(false);
  const supabase = createClient();
  const t = useTranslations("Auth");
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  // Only allow relative paths to avoid open-redirects.
  const next = nextParam?.startsWith("/") ? nextParam : "/dashboard";

  // Either way out of this page locks both ways out of it.
  const busy = loading || oauthLoading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Only invalid_credentials gets a written message; anything else is an
        // English Supabase string, so it is logged rather than shown raw.
        if (error.code !== "invalid_credentials") {
          console.error("Sign-in failed:", error);
        }
        setLoginError(
          error.code === "invalid_credentials"
            ? t("invalidCredentials")
            : t("errorGeneric")
        );
        return;
      }

      if (data.user) {
        // Anything this account reserved as a guest — with this same address —
        // follows them in now. Signing in is the only moment the two identities
        // are both provable.
        const claimed = await claimGuestReservations(supabase);
        navigatingRef.current = true;
        window.location.href = withClaimedParam(next, claimed);
        return;
      }
    } catch (error) {
      console.error("Sign-in threw:", error);
      setLoginError(t("errorGeneric"));
    } finally {
      // Stay disabled while the page is on its way out.
      if (!navigatingRef.current) setLoading(false);
    }
  }

  return (
    <>
      <h2 className="text-2xl font-semibold mb-8">{t("loginTitle")}</h2>
      <button
        className="btn btn-primary"
        type="button"
        disabled={busy}
        data-busy={oauthLoading || undefined}
        onClick={async () => {
          setOauthLoading(true);
          setLoginError(null);
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: `${process.env.NEXT_PUBLIC_WEB_URL}/api/auth/callback?next=${encodeURIComponent(next)}`,
            },
          });
          // On success the browser is already leaving, so the button stays
          // disabled on purpose. Only a failure hands it back.
          if (error) {
            console.error("Google sign-in failed:", error);
            setLoginError(t("errorGeneric"));
            setOauthLoading(false);
          }
        }}
      >
        <FaGoogle />
        {t("signInWithGoogle")}
      </button>
      <div className="divider">{t("or")}</div>
      <form onSubmit={onSubmit} className="space-y-3">
        <fieldset className="fieldset">
          <label className="label" htmlFor="login-email">
            {t("emailLabel")}
          </label>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="input w-full"
            placeholder={t("emailPlaceholder")}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="label" htmlFor="login-password">
            {t("passwordLabel")}
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className="input w-full"
            placeholder={t("passwordLabel")}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {loginError && (
            <p className="text-sm text-error mt-2" role="alert">
              {loginError}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Link href="/forgot-password" className="link link-hover">
              {t("forgotPasswordLink")}
            </Link>
            <Link href="/register" className="link link-hover">
              {t("doNotHaveAccountLink")}
            </Link>
          </div>

          <button
            type="submit"
            className="btn btn-neutral mt-4"
            disabled={busy}
            data-busy={loading || undefined}
          >
            {t("ctaLogin")}
          </button>
        </fieldset>
      </form>
    </>
  );
}
