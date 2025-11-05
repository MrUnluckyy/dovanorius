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
        throw Error(error.message);
      }

      if (data.user) {
        window.location.href = `/boards`;
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
        className="btn btn-accent"
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
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="label">Password</label>
          <input
            type="password"
            className="input"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <a className="link link-hover">Forgot password?</a>
            <Link href="/register" className="link link-hover">
              Do not have an account?
            </Link>
          </div>

          <button className="btn btn-neutral mt-4">
            {loading ? "Logging in..." : "Log in"}
          </button>
        </fieldset>
      </form>
    </>
  );
}
