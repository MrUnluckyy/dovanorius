import { supabaseAdmin } from "@/utils/supabase/admin";
import type { AffiliateMerchant } from "@/types/affiliate";

/**
 * Candidate hostnames to match a URL against a merchant's `domains` array:
 * the full host, the host without a leading `www.`, and the registrable
 * domain (last two labels). Covers rows stored as either `zara.com` or
 * `www.zara.com` without needing an exact host match.
 */
function candidateHosts(host: string): string[] {
  const lower = host.toLowerCase();
  const bare = lower.replace(/^www\./, "");
  const labels = bare.split(".");
  const registrable =
    labels.length > 2 ? labels.slice(-2).join(".") : bare;
  return Array.from(new Set([lower, bare, registrable]));
}

/**
 * Look up the affiliate merchant that owns `targetUrl`'s host, or `null` if
 * none (or the URL is unparseable). Uses the service-role client so it works
 * for anonymous outbound clicks.
 */
export async function resolveMerchant(
  targetUrl: string
): Promise<AffiliateMerchant | null> {
  let host: string;
  try {
    host = new URL(targetUrl).hostname;
  } catch {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("affiliate_merchants")
    .select("*")
    .eq("is_active", true)
    .overlaps("domains", candidateHosts(host))
    .limit(1);

  if (error || !data?.length) return null;
  return data[0] as AffiliateMerchant;
}
