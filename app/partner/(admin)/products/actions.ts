"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import type { PartnerProduct } from "@/types/partner";
import {
  validateProductInput,
  MAX_BULK,
  type ProductInput,
} from "./_lib/validate";

// Actions return a discriminated result rather than throwing for handled cases:
// server-action exceptions are redacted to an opaque digest in production, which
// would swallow the Lithuanian validation messages we want to show the partner.
export type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Resolve the caller's partner from their membership — never from a client-sent
 * id. Uses the user-scoped client so RLS (is_partner_member + pending-only) stays
 * a second gate. Returns null when the caller isn't a partner member.
 */
async function resolvePartner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("partner_users")
    .select("partner_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.partner_id) return null;
  return { supabase, partnerId: membership.partner_id as string };
}

export async function createPartnerProduct(
  input: ProductInput
): Promise<ActionResult<{ product: PartnerProduct }>> {
  const ctx = await resolvePartner();
  if (!ctx) return { ok: false, error: "Neautorizuota." };

  const v = validateProductInput(input);
  if (!v.ok) return { ok: false, error: v.error };

  const { data, error } = await ctx.supabase
    .from("partner_products")
    .insert({ ...v.value, partner_id: ctx.partnerId, status: "pending" })
    .select()
    .single();
  if (error) return { ok: false, error: "Nepavyko sukurti." };

  revalidatePath("/partner/products");
  return { ok: true, product: data as PartnerProduct };
}

export async function updatePartnerProduct(
  id: string,
  input: ProductInput
): Promise<ActionResult<{ product: PartnerProduct }>> {
  const ctx = await resolvePartner();
  if (!ctx) return { ok: false, error: "Neautorizuota." };

  const v = validateProductInput(input);
  if (!v.ok) return { ok: false, error: v.error };

  const { data, error } = await ctx.supabase
    .from("partner_products")
    // Any edit re-enters moderation; scope to the caller's own partner.
    .update({ ...v.value, status: "pending" })
    .eq("id", id)
    .eq("partner_id", ctx.partnerId)
    .select()
    .single();
  if (error) return { ok: false, error: "Nepavyko išsaugoti." };

  revalidatePath("/partner/products");
  return { ok: true, product: data as PartnerProduct };
}

export async function bulkCreatePartnerProducts(
  rows: ProductInput[]
): Promise<ActionResult<{ inserted: PartnerProduct[]; skipped: number }>> {
  const ctx = await resolvePartner();
  if (!ctx) return { ok: false, error: "Neautorizuota." };

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "Nėra produktų." };
  }

  const capped = rows.slice(0, MAX_BULK);
  let skipped = rows.length - capped.length; // rows dropped by the size cap

  const clean = [];
  for (const r of capped) {
    const v = validateProductInput(r);
    if (v.ok) {
      clean.push({ ...v.value, partner_id: ctx.partnerId, status: "pending" });
    } else {
      skipped++;
    }
  }

  if (clean.length === 0) return { ok: false, error: "Nerasta tinkamų produktų." };

  const { data, error } = await ctx.supabase
    .from("partner_products")
    .insert(clean)
    .select();
  if (error) return { ok: false, error: "Importas nepavyko." };

  revalidatePath("/partner/products");
  return { ok: true, inserted: data as PartnerProduct[], skipped };
}
