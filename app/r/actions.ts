"use server";

import { supabaseAdmin } from "@/utils/supabase/admin";
import { verifyReservationToken } from "@/lib/reservationToken";
import { holdExpiryFrom } from "@/lib/reservationWindow";

export type ReservationAction = "keep" | "release";

export type ResolveResult =
  | { status: "kept" }
  | { status: "released" }
  | { status: "invalid" } // bad/expired token
  | { status: "gone" }; // reservation no longer active

export async function resolveReservation(
  token: string,
  action: ReservationAction
): Promise<ResolveResult> {
  const verified = verifyReservationToken(token);
  if (!verified) return { status: "invalid" };

  const { itemId } = verified;

  if (action === "keep") {
    const expires = holdExpiryFrom();
    const { data, error } = await supabaseAdmin
      .from("items")
      .update({
        reserve_expires_at: expires.toISOString(),
        reminder_sent_at: null, // allow a fresh reminder before the new expiry
      })
      .eq("id", itemId)
      .eq("status", "reserved")
      .is("archived_at", null)
      .select("id");

    if (error) throw error;
    return data && data.length > 0 ? { status: "kept" } : { status: "gone" };
  }

  // release
  const { data, error } = await supabaseAdmin
    .from("items")
    .update({
      status: "wanted",
      reserved_by: null,
      reserved_at: null,
      reserve_expires_at: null,
      reminder_email: null,
      reminder_sent_at: null,
    })
    .eq("id", itemId)
    .eq("status", "reserved")
    .is("archived_at", null)
    .select("id");

  if (error) throw error;
  return data && data.length > 0 ? { status: "released" } : { status: "gone" };
}
