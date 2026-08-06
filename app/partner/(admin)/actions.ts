"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { ACTIVE_PARTNER_COOKIE } from "@/lib/partner/context";

/**
 * Switch which partner the panel is scoped to. Validates membership before
 * writing the cookie so it can only ever select among partners the caller
 * already belongs to.
 */
export async function setActivePartner(
  partnerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Neautorizuota." };

  const { data: membership } = await supabase
    .from("partner_users")
    .select("partner_id")
    .eq("user_id", user.id)
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (!membership) return { ok: false, error: "Nesate šio partnerio narys." };

  (await cookies()).set(ACTIVE_PARTNER_COOKIE, partnerId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/partner", "layout");
  return { ok: true };
}
