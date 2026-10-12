import { supabaseAdmin } from "@/utils/supabase/admin";

/**
 * Direct partners (shops in /admin/partners) have no affiliate network, so a
 * click to them carries nothing a network could attribute. /out tags their
 * links itself instead: UTM parameters, which Shopify and WooCommerce show in
 * their own sales reports, plus `nr_click` — the click's sub_id, which is what
 * an order's landing URL can later be matched against.
 */

const strip = (host: string) => host.toLowerCase().replace(/^www\./, "");

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return strip(new URL(value.includes("://") ? value : `https://${value}`).hostname);
  } catch {
    return null;
  }
}

/** The active partner whose shop serves `targetUrl`, by store domain or website. */
export async function resolvePartner(targetUrl: string): Promise<string | null> {
  const host = hostOf(targetUrl);
  if (!host) return null;

  // A handful of rows; filtering in SQL would need the same normalisation.
  const { data, error } = await supabaseAdmin
    .from("partners")
    .select("id, store_domain, website_url")
    .eq("is_active", true);
  if (error || !data) return null;

  const match = data.find(
    (p) => hostOf(p.store_domain) === host || hostOf(p.website_url) === host
  );
  return match?.id ?? null;
}

export type ClickSource = "discover" | "board";

export function tagPartnerUrl(targetUrl: string, subId: string, source: ClickSource): string {
  const url = new URL(targetUrl);
  url.searchParams.set("utm_source", "noriuto");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", source);
  url.searchParams.set("nr_click", subId);
  return url.toString();
}

