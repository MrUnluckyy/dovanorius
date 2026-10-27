// No posthog-js import here: the Google sign-in callback (a server route)
// reads this cookie too.

// ── Why someone signed up ────────────────────────────────────────────────────
//
// Landing on a shared list or an event invite is the moment that explains a
// sign-up that happens minutes later on another page. The landing pages leave
// a first-party cookie; sign-up reads it (the Google callback reads it
// server-side, see lib/analyticsServer.ts). Not personal data: a reason and,
// for a list, its board id.

export type SignupContext = {
  signup_context: "reserve_flow" | "ss_invite" | "organic";
  signup_board_id: string | null;
};

export const SIGNUP_CONTEXT_COOKIE = "nr_signup_ctx";

export function rememberSignupContext(
  context: "reserve_flow" | "ss_invite",
  boardId?: string | null
) {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(JSON.stringify({ c: context, b: boardId ?? null }));
  document.cookie = `${SIGNUP_CONTEXT_COOKIE}=${value}; Max-Age=${60 * 60 * 24 * 30}; Path=/; SameSite=Lax`;
}

/** Parses the cookie value; anything unexpected reads as "organic". */
export function parseSignupContext(raw: string | null | undefined): SignupContext {
  try {
    const v = raw ? JSON.parse(decodeURIComponent(raw)) : null;
    if (v && (v.c === "reserve_flow" || v.c === "ss_invite")) {
      return {
        signup_context: v.c,
        signup_board_id: typeof v.b === "string" ? v.b : null,
      };
    }
  } catch {
    // Malformed cookie: fall through.
  }
  return { signup_context: "organic", signup_board_id: null };
}

export function readSignupContext(): SignupContext {
  if (typeof document === "undefined") return parseSignupContext(null);
  const match = document.cookie.match(new RegExp(`(?:^|; )${SIGNUP_CONTEXT_COOKIE}=([^;]*)`));
  return parseSignupContext(match?.[1]);
}
