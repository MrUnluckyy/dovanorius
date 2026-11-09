"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { addManagedMemberWith } from "@/lib/events/managed";
import type { AddManagedResult } from "@/lib/events/managed";

/**
 * Add somebody to an event by name only (see lib/events/managed.ts). The
 * mobile app reaches the same code through /api/events/managed.
 */
export async function addManagedMember(
  slug: string,
  name: string
): Promise<AddManagedResult> {
  const supabase = await createClient();
  const result = await addManagedMemberWith(supabase, slug, name);
  if (result.ok) revalidatePath(`/renginiai/${slug}`);
  return result;
}
