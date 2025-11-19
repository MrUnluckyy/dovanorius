"use server";

import { supabaseAdmin } from "@/utils/supabase/admin";

export async function deleteUserAction(userId: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) {
    console.error("Error deleting auth user:", error);
    throw new Error("Failed to delete user");
  }

  return { success: true };
}
