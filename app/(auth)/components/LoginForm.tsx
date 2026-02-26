"use client";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { FaGoogle } from "react-icons/fa6";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const supabase = createClient();
  const t = useTranslations("Auth");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoginError(
          error.code === "invalid_credentials"
            ? t("invalidCredentials")
            : error.message
        );
        throw Error(error.message);
      }

      if (data.user) {
        window.location.href = `/dashboard`;
        return;
      }
    } catch (error) {
      console.log("Error signing up:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="text-2xl font-semibold mb-8">{t("loginTitle")}</h2>
      <button
        className="btn btn-primary"
        type="button"
        onClick={() =>
          supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: `${process.env.NEXT_PUBLIC_WEB_URL}/api/auth/callback`,
            },
          })
        }
      >
        <FaGoogle />
        {t("signInWithGoogle")}
      </button>
      <div className="divider">{t("or")}</div>
      <form onSubmit={onSubmit} className="space-y-3">
        <fieldset className="fieldset">
          <label className="label">{t("emailLabel")}</label>
          <input
            type="email"
            className="input"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="label">{t("passwordLabel")}</label>
          <input
            type="password"
            className="input"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {loginError && (
            <p className="text-sm text-error mt-2">{loginError}</p>
          )}
          <div className="flex flex-col gap-2">
            <Link href="forgot-password" className="link link-hover">
              {t("forgotPasswordLink")}
            </Link>
            <Link href="/register" className="link link-hover">
              {t("doNotHaveAccountLink")}
            </Link>
          </div>

          <button
            type="submit"
            className="btn btn-neutral mt-4"
            disabled={loading}
          >
            {loading ? (
              <span className="loading loading-dots loading-md"></span>
            ) : (
              t("ctaLogin")
            )}
          </button>
        </fieldset>
      </form>
    </>
  );
}
