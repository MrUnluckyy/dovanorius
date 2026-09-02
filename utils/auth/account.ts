import type { User } from "@supabase/supabase-js";

/**
 * Whether this session belongs to a real account rather than a guest.
 *
 * A guest who reserves a gift carries an anonymous Supabase session: truthy,
 * with a stable `auth.uid()`, and indistinguishable from a signed-in user to
 * any check written as `!user`. That is how a guest reached /boards and built
 * a board they would lose the moment their cookies cleared, and how the navbar
 * came to hide Login from people who already had an account.
 *
 * Reserving a gift is the one thing a guest is meant to do without an account.
 * Anything that CREATES or OWNS data must ask for one.
 */
export function isAccountUser(user: User | null | undefined): user is User {
  return !!user && user.is_anonymous !== true;
}

/** Where to send a guest so they come back to what they were doing. */
export function loginRedirect(next?: string): string {
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}
