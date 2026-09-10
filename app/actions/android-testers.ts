"use server";

import { createClient } from "@/utils/supabase/server";

export type InterestResult = { ok: true } | { ok: false; error: string };

/** Deliberately loose — the real check is Google's, when the link is issued. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function save(row: {
  status: "interested" | "dismissed";
  google_email?: string | null;
}): Promise<InterestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Guests are excluded upstream (the prompt only renders for real accounts),
  // but the action is a public entry point of its own and cannot assume that.
  if (!user || user.is_anonymous) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase.from("android_tester_interest").upsert(
    {
      user_id: user.id,
      ...row,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("android tester interest save failed:", error);
    return { ok: false, error: "save_failed" };
  }
  return { ok: true };
}

/** "I'll test it" — with the Google account the Play list has to be keyed on. */
export async function registerTesterInterest(
  googleEmail: string
): Promise<InterestResult> {
  const trimmed = googleEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) return { ok: false, error: "invalid_email" };
  return save({ status: "interested", google_email: trimmed });
}

/**
 * "Not me" — stored rather than kept in localStorage so the prompt stays gone
 * on the person's other devices too. Someone who has said no once should not
 * be asked again just because they opened the site on a laptop.
 */
export async function dismissTesterPrompt(): Promise<InterestResult> {
  return save({ status: "dismissed", google_email: null });
}
