"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { RECIPIENT_KEYS } from "@/lib/discover/recipients";
import { CATEGORY_SLUGS } from "@/lib/discover/routes";

/**
 * Sponsored placements on discover. Everything runs through the service role:
 * discover_placements has a public read policy for live rows and no write
 * policies at all, so only these actions can change it.
 */

// Same shape as the editorial actions: server-action exceptions are redacted
// in production, which would swallow the Lithuanian messages.
export type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };
export type SimpleResult = { ok: true } | { ok: false; error: string };

export type PlacementInput = {
  advertiser: string;
  headline: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  productIds: string[];
  recipients: string[];
  categories: string[];
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
};

const BUCKET = "discover-placements";
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

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

function revalidate(id?: string) {
  revalidatePath("/admin/placements");
  if (id) revalidatePath(`/admin/placements/${id}`);
}

/** Validates and maps form input to a row. Returns an error message or the row. */
function toRow(input: PlacementInput): string | Record<string, unknown> {
  const advertiser = input.advertiser.trim();
  const headline = input.headline.trim();
  const body = input.body.trim();
  const ctaLabel = input.ctaLabel.trim() || "Apsilankyti";
  const ctaUrl = input.ctaUrl.trim();

  if (!advertiser || advertiser.length > 60) return "Nurodykite reklamuotoją (iki 60 simbolių).";
  if (!headline || headline.length > 120) return "Antraštė privaloma (iki 120 simbolių).";
  if (body.length > 280) return "Tekstas per ilgas (iki 280 simbolių).";
  if (ctaLabel.length > 30) return "Mygtuko tekstas per ilgas (iki 30 simbolių).";
  if (!/^https:\/\//.test(ctaUrl)) return "Nuoroda turi prasidėti https://";
  try {
    new URL(ctaUrl);
  } catch {
    return "Nuoroda neteisinga.";
  }
  if (!input.imageUrl) return "Įkelkite paveikslėlį.";
  if (input.productIds.length > 6) return "Daugiausia 6 produktai.";

  const recipients = input.recipients.filter((r) => (RECIPIENT_KEYS as readonly string[]).includes(r));
  const categories = input.categories.filter((c) => c in CATEGORY_SLUGS);
  if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
    return "Pabaigos data turi būti vėlesnė už pradžios datą.";
  }

  return {
    advertiser,
    headline,
    body: body || null,
    image_url: input.imageUrl,
    cta_label: ctaLabel,
    cta_url: ctaUrl,
    product_ids: [...new Set(input.productIds)].slice(0, 6),
    recipients,
    categories,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
    priority: Number.isFinite(input.priority) ? Math.trunc(input.priority) : 0,
    updated_at: new Date().toISOString(),
  };
}

export async function createPlacement(input: PlacementInput): Promise<ActionResult<{ id: string }>> {
  await requireAdminId();
  const row = toRow(input);
  if (typeof row === "string") return { ok: false, error: row };
  const { data, error } = await supabaseAdmin
    .from("discover_placements")
    .insert({ ...row, is_active: true })
    .select("id")
    .single();
  if (error) return { ok: false, error: "Nepavyko sukurti reklamos." };
  revalidate();
  return { ok: true, id: data.id as string };
}

export async function updatePlacement(id: string, input: PlacementInput): Promise<SimpleResult> {
  await requireAdminId();
  const row = toRow(input);
  if (typeof row === "string") return { ok: false, error: row };
  const { error } = await supabaseAdmin.from("discover_placements").update(row).eq("id", id);
  if (error) return { ok: false, error: "Nepavyko išsaugoti." };
  revalidate(id);
  return { ok: true };
}

export async function setPlacementActive(id: string, isActive: boolean): Promise<SimpleResult> {
  await requireAdminId();
  const { error } = await supabaseAdmin
    .from("discover_placements")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "Nepavyko pakeisti būsenos." };
  revalidate(id);
  return { ok: true };
}

export async function deletePlacement(id: string): Promise<SimpleResult> {
  await requireAdminId();
  const { error } = await supabaseAdmin.from("discover_placements").delete().eq("id", id);
  if (error) return { ok: false, error: "Nepavyko ištrinti." };
  revalidate();
  return { ok: true };
}

/** Uploads the placement image to the public bucket; returns its URL. */
export async function uploadPlacementImage(form: FormData): Promise<ActionResult<{ url: string }>> {
  await requireAdminId();
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Nepasirinktas failas." };
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { ok: false, error: "Tinka JPG, PNG, WebP arba AVIF." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Failas per didelis (iki 3 MB)." };

  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) return { ok: false, error: "Nepavyko įkelti paveikslėlio." };

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
