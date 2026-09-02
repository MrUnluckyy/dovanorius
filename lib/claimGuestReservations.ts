import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pulls holds made as a guest into the account that now owns the address.
 *
 * Anonymous sessions render as "signed in" everywhere they aren't explicitly
 * checked, so account holders reserved as guests without realising, and the
 * gift landed in a session they can never open again. The address they typed
 * is the only thread back; proving it at sign-in follows the thread.
 *
 * Never allowed to fail a sign-in. A claim missed here is picked up at the
 * next sign-in; a login blocked by a bookkeeping call is not recoverable.
 */
export async function claimGuestReservations(
  supabase: SupabaseClient
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc("claim_guest_reservations");
    if (error) {
      console.error("Claiming guest reservations failed:", error);
      return 0;
    }
    return typeof data === "number" ? data : 0;
  } catch (error) {
    console.error("Claiming guest reservations threw:", error);
    return 0;
  }
}

/**
 * Carries the claim count to whatever page the sign-in was headed for, so the
 * gifts don't just silently appear. Preserves any params `next` already has
 * (the reserve flow sends `?wish=<id>`).
 */
export function withClaimedParam(next: string, claimed: number): string {
  if (claimed < 1) return next;
  try {
    const url = new URL(next, "http://internal.invalid");
    url.searchParams.set("claimed", String(claimed));
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return next;
  }
}
