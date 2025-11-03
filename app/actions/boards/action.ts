"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function createBoard(name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("boards")
    .insert({ owner_id: user.id, name });
  if (error) throw error;

  revalidatePath(`/${user.id}/wishlist`);
}

export async function getBoards() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("boards")
    .select("id,name,created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getBoard(boardId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boards")
    .select("id, owner_id, name, slug, description, created_at, is_public")
    .eq("id", boardId)
    .single();

  if (error) throw error;
  return data;
}
