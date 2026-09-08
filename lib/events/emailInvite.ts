import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EventInviteEmail } from "@/emails/EventInviteEmail";
import type { SsEventInvite } from "@/types/secret-santa";

/** The address every event mail is sent from. */
export const MAIL_FROM =
  process.env.RESEND_FROM ?? "Noriuto <noreply@noriuto.lt>";

/**
 * Base for the links inside invitation mail.
 *
 * Not `lib/siteUrl`: that normalises to `www`, and these links are also the
 * ones the app shares, where the apex is what `app.json` declares. The apex
 * redirects to `www` on click, which costs a hop and nothing else.
 */
export const INVITE_BASE_URL =
  process.env.NEXT_PUBLIC_WEB_URL ?? "https://noriuto.lt";

/** Where an invitation token sends whoever opens it. */
export function joinUrlFor(token: string): string {
  return `${INVITE_BASE_URL}/events/join/${token}`;
}

export type AdminEvent = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  join_token: string;
  type: string;
  event_date: string | null;
  budget: number | null;
  currency: string | null;
};

export type AdminContext =
  | { error: "not_authenticated" | "not_found" | "not_allowed" }
  | { supabase: SupabaseClient; userId: string; event: AdminEvent };

/**
 * Resolve a slug to an event the caller is allowed to organise.
 *
 * Every invitation path goes through here, whichever client asked. RLS would
 * stop the write anyway, but a policy violation surfaces as an opaque Postgres
 * error; a `not_allowed` we raise ourselves is something the UI can translate.
 *
 * The client is a parameter rather than created here because the callers do not
 * agree on where the session lives: the website's server actions read a cookie,
 * the mobile app arrives with a bearer token.
 */
export async function requireAdminEvent(
  supabase: SupabaseClient,
  slug: string
): Promise<AdminContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" as const };

  const { data: event } = await supabase
    .from("ss_events")
    .select("id, name, slug, owner_id, join_token, type, event_date, budget, currency")
    .eq("slug", slug)
    .single<AdminEvent>();
  if (!event) return { error: "not_found" as const };

  const { data: isAdmin } = await supabase.rpc("is_event_admin", {
    e: event.id,
  });
  if (!isAdmin) return { error: "not_allowed" as const };

  return { supabase, userId: user.id, event };
}

export type InviteResult =
  | { ok: true; invite: SsEventInvite; emailSent: boolean }
  | { ok: false; error: string };

/**
 * The name an invitation is signed with.
 *
 * `user_metadata.display_name` is set by the website's own sign-up, but a
 * Google or Apple sign-in — which is how most people arrive in the app — puts
 * the name under a different key or not at all, so the profile is the reliable
 * source and the metadata only a fallback.
 */
async function resolveInviterName(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle<{ display_name: string | null }>();
  if (profile?.display_name) return profile.display_name;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = user?.user_metadata ?? {};
  return (
    (meta.display_name as string | undefined) ??
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined) ??
    null
  );
}

/** Invite somebody by e-mail address, whether or not they have an account. */
export async function inviteByEmailWith(
  supabase: SupabaseClient,
  slug: string,
  email: string
): Promise<InviteResult> {
  const ctx = await requireAdminEvent(supabase, slug);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { userId, event } = ctx;

  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: "invalid_email" };
  }

  // Re-inviting the same address reuses its row (and its token), so a person
  // who was sent two invitations does not end up with two links, one of which
  // silently stops working.
  const { data: existing } = await supabase
    .from("ss_event_invites")
    .select("*")
    .eq("event_id", event.id)
    .eq("email", trimmed)
    .is("accepted_at", null)
    .maybeSingle<SsEventInvite>();

  let invite = existing;
  if (!invite) {
    const { data, error } = await supabase
      .from("ss_event_invites")
      .insert({ event_id: event.id, email: trimmed, invited_by: userId })
      .select("*")
      .single<SsEventInvite>();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "insert_failed" };
    }
    invite = data;
  }

  // Best-effort send: the invitation row exists either way, and the organiser
  // can always fall back to copying the link.
  let emailSent = false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    // resend.emails.send() RESOLVES with { data, error } — it does not throw.
    // Reading only the promise would report a refused send as a success and
    // leave the organiser believing the invitation went out.
    const { error: sendError } = await resend.emails.send({
      from: MAIL_FROM,
      to: trimmed,
      subject: `Kvietimas: ${event.name} 🎁`,
      react: EventInviteEmail({
        eventName: event.name,
        inviterName: await resolveInviterName(supabase, userId),
        joinUrl: joinUrlFor(invite.token),
        eventDate: event.event_date,
        budget: event.budget,
        currency: event.currency,
      }),
    });
    if (sendError) throw sendError;
    emailSent = true;
  } catch (err) {
    console.error("Failed to send event invite email:", err);
  }

  return { ok: true, invite, emailSent };
}
