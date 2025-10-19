"use client";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useState } from "react";

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

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
      console.log("Error signing up:", error);
    } finally {
      setLoading(false);
      setCompleted(true);
    }
  }

  return (
    <>
      <h2 className="text-2xl font-semibold">Hey There! 👋 </h2>
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

          <button className="btn btn-neutral mt-4">
            {loading ? "Signing up..." : "Register"}
          </button>

          {completed && (
            <p className="text-green-600 mt-2">
              Registration complete! Please check your email to verify your
              account.
            </p>
          )}
        </fieldset>
      </form>
    </>
  );
}
