"use client";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { LuCheck } from "react-icons/lu";

export default function SetNewPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const supabase = createClient();
  const t = useTranslations("Auth");

  useEffect(() => {
    // Optional: confirm we have a recovery session
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")
        setReady(true);
    });
    // If the session is already there, still allow form:
    supabase.auth.getSession().then(() => setReady(true));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    setMsg(error ? error.message : "Password updated. You can now continue.");
    setSuccess(!error);
  }

  if (!ready) return <p>Preparing reset…</p>;

  return (
    <>
      <h2 className="text-2xl font-semibold mb-8">{t("newPasswordTitle")}</h2>
      {success ? (
        <div className="flex flex-col items-center justify-center w-full text-center gap-8">
          <div className="bg-accent rounded-full p-4">
            <LuCheck className="w-20 h-20" />
          </div>
          <p>Slaptažodžio pakeistas. Galite grįžti į pradinį puslapį.</p>
          <Link href="/" className="btn">
            Grįžti į pradinį puslapį
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="max-w-sm space-y-3">
          <label className="block">
            <span>New password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border p-2 rounded"
              required
            />
          </label>
          <button disabled={loading} className="px-3 py-2 border rounded">
            {loading ? "Updating…" : "Set new password"}
          </button>
          {msg && <p>{msg}</p>}
        </form>
      )}
    </>
  );
}
