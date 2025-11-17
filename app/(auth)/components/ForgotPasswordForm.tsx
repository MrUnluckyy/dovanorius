"use client";
import { createClient } from "@/utils/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { LuCheck } from "react-icons/lu";

function useRecoverPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message ?? "Failed to send reset email");
      }
      return data;
    },
  });
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const t = useTranslations("Auth");
  const supabase = createClient();

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
      <h2 className="text-2xl font-semibold font-heading">
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
            <label className="label">El. paštas</label>
            <input
              type="email"
              className="input"
              placeholder="El. paštas"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="flex flex-col gap-2">
              <Link href="/login" className="link link-hover">
                Atgal į prisijungimo puslapį
              </Link>
            </div>

            <button
              type="submit"
              className="btn btn-neutral mt-4"
              disabled={loading}
            >
              {loading ? "Siunčiama" : "Siųsti"}
            </button>
          </fieldset>
        </form>
      )}
    </>
  );
}
