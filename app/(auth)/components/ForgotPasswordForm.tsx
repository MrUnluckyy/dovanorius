"use client";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { FaGoogle } from "react-icons/fa6";
import { LuCheck } from "react-icons/lu";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const supabase = createClient();
  const t = useTranslations("Auth");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_WEB_URL}/reset-password`,
      });
      if (data) {
        setSuccess(true);
      }

      if (error) {
        throw Error(error.message);
      }
    } catch (error) {
      console.log("Error getting new password:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="text-2xl font-semibold mb-8">
        {t("forgotPasswordTitle")}
      </h2>

      {success ? (
        <div className="flex flex-col items-center justify-center w-full text-center gap-8">
          <div className="bg-accent rounded-full p-4">
            <LuCheck className="w-20 h-20" />
          </div>
          <p>Slaptažodžio atstatymo nuoroda išsiųsta į jūsų el. paštą.</p>
          <Link href="/" className="btn">
            Grįžti į pradinį puslapį
          </Link>
        </div>
      ) : (
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
            <div className="flex flex-col gap-2">
              <Link href="/login" className="link link-hover">
                Atgal į prisijungimo puslapį
              </Link>
            </div>

            <button type="submit" className="btn btn-neutral mt-4">
              {loading ? "Siunčiama" : "Siųsti"}
            </button>
          </fieldset>
        </form>
      )}
    </>
  );
}
