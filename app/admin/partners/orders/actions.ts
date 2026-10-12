"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

export type SimpleResult = { ok: true } | { ok: false; error: string };

async function requireAdminId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) throw new Error("Forbidden");

  return user.id;
}

/**
 * Store the signing key Shopify shows under Settings → Notifications →
 * Webhooks. Without it the webhook route rejects every delivery, so this is
 * what switches order tracking on for a partner. Empty clears it.
 */
export async function setShopifyWebhookSecret(
  partnerId: string,
  secret: string
): Promise<SimpleResult> {
  await requireAdminId();

  const value = secret.trim();
  if (!value) {
    const { error } = await supabaseAdmin
      .from("partner_webhook_secrets")
      .delete()
      .eq("partner_id", partnerId)
      .eq("platform", "shopify");
    if (error) return { ok: false, error: "Nepavyko išjungti sekimo." };
  } else {
    // Shopify's key is a long hex string; anything short is a paste mistake.
    if (value.length < 20 || /\s/.test(value)) {
      return { ok: false, error: "Tai nepanašu į Shopify parašo raktą." };
    }
    const { error } = await supabaseAdmin
      .from("partner_webhook_secrets")
      .upsert({ partner_id: partnerId, platform: "shopify", secret: value });
    if (error) return { ok: false, error: "Nepavyko išsaugoti rakto." };
  }

  revalidatePath("/admin/partners/orders");
  return { ok: true };
}
