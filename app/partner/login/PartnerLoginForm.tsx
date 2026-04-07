"use client";
import { createClient } from "@/utils/supabase/client";
import { useState } from "react";

export function PartnerLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(
        error.code === "invalid_credentials"
          ? "Neteisingas el. paštas arba slaptažodis."
          : error.message
      );
      return;
    }

    if (data.user) {
      window.location.href = "/partner";
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label label-text text-xs">El. paštas</label>
        <input
          type="email"
          className="input input-bordered w-full"
          placeholder="jusu@imone.lt"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="label label-text text-xs">Slaptažodis</label>
        <input
          type="password"
          className="input input-bordered w-full"
          placeholder="••••••••"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      <button
        type="submit"
        className="btn btn-primary w-full mt-2"
        disabled={loading}
      >
        {loading ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          "Prisijungti"
        )}
      </button>
    </form>
  );
}
