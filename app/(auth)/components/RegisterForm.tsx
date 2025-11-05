"use client";
import { useToast } from "@/components/providers/ToastProvider";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { FaGoogle } from "react-icons/fa6";

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const t = useTranslations("Auth");

  const { toastError } = useToast();

  const supabase = createClient();
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      console.log(data);

      if (error) {
        throw Error(error.message);
      }
    } catch (error) {
      toastError("Error signing up");
      console.log("Error signing up:", error);
    } finally {
      setLoading(false);
      setCompleted(true);
    }
  }

  if (completed) {
    return (
      <div className="spacing-y-8">
        <h2 className="text-2xl font-semibold text-center">All done! 👋 </h2>
        <p className="text-center">
          Registration complete! Please check your email to verify your account.
        </p>
        <Link href="/login" className="btn">
          Done
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-semibold">Hey There! 👋 </h2>
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
        {t("registerWithGoogle")}
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
          <div>
            <a className="link link-hover">Forgot password?</a>
          </div>
          <Link href="/login" className="link link-hover">
            Already with us? Log in here.
          </Link>

          <button type="submit" className="btn btn-neutral mt-4">
            {loading ? "Signing up..." : "Register"}
          </button>

          {completed && (
            <p className="text-success mt-2">
              Registration complete! Please check your email to verify your
              account.
            </p>
          )}
        </fieldset>
      </form>
    </>
  );
}
