"use server";

import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Editorial shelves: hand-picked, scheduled shelves on /discover.
 *
 * Everything here runs through the service role. `editorial_picks` has RLS on
 * with no policies at all, so it is unreachable by any client key — picks are
 * staff-authored and the public only ever sees the projection in
 * persona_products.
 *
 * Every mutation that touches picks ends with syncPicks(). persona_products is
 * a derived table for editorial shelves; letting the two drift is exactly the
 * silent failure this feature was built to avoid.
 */

// Same shape the partner actions use — server-action exceptions get redacted to
// an opaque digest in production, which would swallow the Lithuanian messages.
export type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };
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

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Rebuild persona_products from the intent table for one shelf. */
async function syncPicks(personaId: string) {
  const { error } = await supabaseAdmin.rpc("sync_editorial_picks", {
    p_persona_id: personaId,
  });
  if (error) throw new Error(`sync: ${error.message}`);
}

function revalidate(personaId?: string) {
  revalidatePath("/admin/editorial");
  if (personaId) revalidatePath(`/admin/editorial/${personaId}`);
}

/**
 * Guard every write: these actions take a persona id from the client, and
 * nothing else stops that id naming an LLM-curated shelf. Editing one here
 * would let an admin hand-pick a shelf that the Monday curator then wipes —
 * the exact failure the `kind` split exists to prevent.
 */
async function requireEditorial(personaId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("gift_personas")
    .select("kind, slug")
    .eq("id", personaId)
    .maybeSingle();

  if (error || !data) throw new Error("Lentyna nerasta.");
  if (data.kind !== "editorial") {
    throw new Error(
      `„${data.slug}" yra ${data.kind} lentyna — ją kuruoja savaitinis LLM, ` +
        `rankiniu būdu redaguoti negalima.`
    );
  }
  return data.slug;
}

/* -------------------------------------------------------------------------- */
/* Shelves                                                                    */
/* -------------------------------------------------------------------------- */

export type ShelfInput = {
  labelLt: string;
  labelEn: string;
  /** Internal note. gift_personas.description is NOT NULL and has no default. */
  description?: string;
  slug?: string;
  /** ISO strings from <input type="datetime-local">, already UTC-converted. */
  startsAt?: string | null;
  endsAt?: string | null;
  sortOrder?: number;
};

function validateWindow(
  startsAt?: string | null,
  endsAt?: string | null
): string | null {
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    return "Pabaigos data turi būti vėlesnė už pradžios datą.";
  }
  return null;
}

export async function createEditorialShelf(
  input: ShelfInput
): Promise<ActionResult<{ id: string }>> {
  await requireAdminId();

  const labelLt = input.labelLt.trim();
  if (labelLt.length < 2) return { ok: false, error: "Pavadinimas per trumpas." };

  const slug = slugify(input.slug?.trim() || labelLt);
  if (!slug) return { ok: false, error: "Nepavyko sugeneruoti nuorodos (slug)." };

  const windowError = validateWindow(input.startsAt, input.endsAt);
  if (windowError) return { ok: false, error: windowError };

  const { data: existing } = await supabaseAdmin
    .from("gift_personas")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return { ok: false, error: `Nuoroda „${slug}" jau naudojama.` };

  const { data, error } = await supabaseAdmin
    .from("gift_personas")
    .insert({
      slug,
      kind: "editorial",
      label_lt: labelLt,
      label_en: input.labelEn.trim() || labelLt,
      description: input.description?.trim() || `Redakcijos lentyna: ${labelLt}`,
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
      sort_order: input.sortOrder ?? 100,
      // Deliberately left at defaults: product_types, include/exclude_keywords,
      // price bounds and examples are curator inputs for the LLM pipeline, and
      // nothing in an editorial shelf's path reads them.
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: "Nepavyko sukurti lentynos." };

  revalidate();
  return { ok: true, id: data.id as string };
}

export async function updateEditorialShelf(
  personaId: string,
  input: ShelfInput
): Promise<SimpleResult> {
  await requireAdminId();
  await requireEditorial(personaId);

  const labelLt = input.labelLt.trim();
  if (labelLt.length < 2) return { ok: false, error: "Pavadinimas per trumpas." };

  const windowError = validateWindow(input.startsAt, input.endsAt);
  if (windowError) return { ok: false, error: windowError };

  const { error } = await supabaseAdmin
    .from("gift_personas")
    .update({
      label_lt: labelLt,
      label_en: input.labelEn.trim() || labelLt,
      description: input.description?.trim() || `Redakcijos lentyna: ${labelLt}`,
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
      sort_order: input.sortOrder ?? 100,
    })
    .eq("id", personaId);

  if (error) return { ok: false, error: "Nepavyko išsaugoti pakeitimų." };

  revalidate(personaId);
  return { ok: true };
}

export async function setEditorialShelfActive(
  personaId: string,
  isActive: boolean
): Promise<SimpleResult> {
  await requireAdminId();
  await requireEditorial(personaId);

  const { error } = await supabaseAdmin
    .from("gift_personas")
    .update({ is_active: isActive })
    .eq("id", personaId);

  if (error) return { ok: false, error: "Nepavyko pakeisti būsenos." };

  revalidate(personaId);
  return { ok: true };
}

/**
 * Delete a shelf and its picks. `editorial_picks` and `persona_products` both
 * cascade off gift_personas, so this is genuinely irreversible — the UI asks
 * first.
 */
export async function deleteEditorialShelf(
  personaId: string
): Promise<SimpleResult> {
  await requireAdminId();
  await requireEditorial(personaId);

  const { error } = await supabaseAdmin
    .from("gift_personas")
    .delete()
    .eq("id", personaId);

  if (error) return { ok: false, error: "Nepavyko ištrinti lentynos." };

  revalidate();
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Picks                                                                      */
/* -------------------------------------------------------------------------- */

export type ProductHit = {
  id: string;
  product_name: string;
  brand_name: string | null;
  merchant_name: string | null;
  price: number | null;
  image_url: string | null;
  in_stock: boolean;
};

/**
 * Product search for the pick browser.
 *
 * ilike on product_name is backed by inspo_products_name_trgm_idx (GIN
 * trigram), so the wildcard prefix is not the table scan it looks like. Only
 * linkable products are offered: a pick with no image or no deep_link renders
 * as a broken card.
 */
export async function searchProducts(
  query: string,
  opts?: { inStockOnly?: boolean }
): Promise<ActionResult<{ hits: ProductHit[] }>> {
  await requireAdminId();

  const q = query.trim();
  if (q.length < 2) return { ok: true, hits: [] };

  let sb = supabaseAdmin
    .from("inspo_products")
    .select("id, product_name, brand_name, merchant_name, price, image_url, in_stock")
    .ilike("product_name", `%${q}%`)
    .not("image_url", "is", null)
    .not("deep_link", "is", null);

  if (opts?.inStockOnly !== false) sb = sb.eq("in_stock", true);

  const { data, error } = await sb
    .order("gift_score", { ascending: false, nullsFirst: false })
    .limit(40);

  if (error) return { ok: false, error: "Paieška nepavyko." };
  return { ok: true, hits: (data ?? []) as ProductHit[] };
}

/**
 * Add a pick, snapshotting name and image.
 *
 * The snapshot is the whole point of the intent table: when the nightly import
 * prunes this product out of inspo_products the pick row survives, and admin
 * can name what was lost instead of showing a silently shorter shelf.
 *
 * Upsert, not insert — the composite PK means re-adding a product that is
 * already picked would otherwise throw rather than being a no-op.
 */
export async function addPick(
  personaId: string,
  productId: string
): Promise<SimpleResult> {
  await requireAdminId();
  await requireEditorial(personaId);

  const { data: product } = await supabaseAdmin
    .from("inspo_products")
    .select("product_name, image_url")
    .eq("id", productId)
    .maybeSingle();

  if (!product) return { ok: false, error: "Produktas nerastas kataloge." };

  // Append to the end rather than fighting for a rank in the middle.
  const { data: last } = await supabaseAdmin
    .from("editorial_picks")
    .select("rank")
    .eq("persona_id", personaId)
    .order("rank", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("editorial_picks").upsert(
    {
      persona_id: personaId,
      product_id: productId,
      rank: (last?.rank ?? 0) + 1,
      name_snapshot: product.product_name,
      image_snapshot: product.image_url,
    },
    { onConflict: "persona_id,product_id" }
  );

  if (error) return { ok: false, error: "Nepavyko pridėti produkto." };

  await syncPicks(personaId);
  revalidate(personaId);
  return { ok: true };
}

export async function removePick(
  personaId: string,
  productId: string
): Promise<SimpleResult> {
  await requireAdminId();
  await requireEditorial(personaId);

  const { error } = await supabaseAdmin
    .from("editorial_picks")
    .delete()
    .eq("persona_id", personaId)
    .eq("product_id", productId);

  if (error) return { ok: false, error: "Nepavyko pašalinti produkto." };

  await syncPicks(personaId);
  revalidate(personaId);
  return { ok: true };
}

/** The hand-written "why this one" line. Already rendered on the product card. */
export async function updatePickReason(
  personaId: string,
  productId: string,
  reason: string
): Promise<SimpleResult> {
  await requireAdminId();
  await requireEditorial(personaId);

  const { error } = await supabaseAdmin
    .from("editorial_picks")
    .update({ reason: reason.trim() || null })
    .eq("persona_id", personaId)
    .eq("product_id", productId);

  if (error) return { ok: false, error: "Nepavyko išsaugoti komentaro." };

  await syncPicks(personaId);
  revalidate(personaId);
  return { ok: true };
}

/**
 * Rewrite ranks to match the given order.
 *
 * Takes the full ordered list rather than a move instruction so the result is
 * always contiguous 1..n and two admins reordering concurrently cannot
 * interleave into a half-applied order.
 */
export async function reorderPicks(
  personaId: string,
  orderedProductIds: string[]
): Promise<SimpleResult> {
  await requireAdminId();
  await requireEditorial(personaId);

  const { data: existing } = await supabaseAdmin
    .from("editorial_picks")
    .select("product_id, reason, name_snapshot, image_snapshot, added_at")
    .eq("persona_id", personaId);

  const byId = new Map((existing ?? []).map((r) => [r.product_id, r]));

  // Upsert the whole set: a bare UPDATE per row would be n round trips, and
  // ranks must land together or the shelf shows a partial order.
  const rows = orderedProductIds
    .filter((id) => byId.has(id))
    .map((id, i) => ({ ...byId.get(id)!, persona_id: personaId, rank: i + 1 }));

  if (!rows.length) return { ok: true };

  const { error } = await supabaseAdmin
    .from("editorial_picks")
    .upsert(rows, { onConflict: "persona_id,product_id" });

  if (error) return { ok: false, error: "Nepavyko pakeisti eiliškumo." };

  await syncPicks(personaId);
  revalidate(personaId);
  return { ok: true };
}

/**
 * Re-run the projection by hand.
 *
 * Useful after an import: a pick that dropped out of the feed and later came
 * back is restored by this without the curator re-picking it.
 */
export async function resyncShelf(personaId: string): Promise<SimpleResult> {
  await requireAdminId();
  await requireEditorial(personaId);

  try {
    await syncPicks(personaId);
  } catch {
    return { ok: false, error: "Nepavyko sinchronizuoti." };
  }

  revalidate(personaId);
  return { ok: true };
}
