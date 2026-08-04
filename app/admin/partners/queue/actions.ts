"use server";

import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

/** Re-check the admin flag inside every action (the layout guard is UI-only). */
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

/** Approve a pending product. The DB trigger projects it into inspo_products. */
export async function approveProduct(id: string) {
  const adminId = await requireAdminId();
  const { error } = await supabaseAdmin
    .from("partner_products")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
      rejection_reason: null,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/partners/queue");
}

/** Reject a pending product with a reason shown back to the partner. */
export async function rejectProduct(id: string, reason: string) {
  const adminId = await requireAdminId();
  const { error } = await supabaseAdmin
    .from("partner_products")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
      rejection_reason: reason.trim() || null,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/partners/queue");
}
