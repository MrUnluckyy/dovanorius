import { redirect } from "next/navigation";
import { getPartnerContext } from "@/lib/partner/context";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { ADAPTERS, type FeedPlatform } from "@/lib/partner-feeds";
import { StoreClient, type StoreState } from "./_components/StoreClient";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const ctx = await getPartnerContext();
  if (!ctx) redirect("/dashboard");

  const partnerId = ctx.active.partnerId;

  // Feed columns aren't exposed by the partners SELECT policy shape used
  // elsewhere, and the counts need to ignore RLS chunking — read as service
  // role, scoped to the already-validated active partner.
  const [{ data: partner }, { count }] = await Promise.all([
    supabaseAdmin
      .from("partners")
      .select(
        "store_domain, feed_platform, feed_auto_approve, feed_last_synced_at, feed_last_status, feed_last_error, feed_last_count"
      )
      .eq("id", partnerId)
      .single(),
    // Every imported row regardless of platform — a partner who switched shops
    // should still see the full synced count, not just the current platform's.
    supabaseAdmin
      .from("partner_products")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partnerId)
      .neq("source", "manual"),
  ]);

  const platform = (partner?.feed_platform ?? null) as FeedPlatform | null;

  const state: StoreState = {
    domain: partner?.store_domain ?? null,
    platform,
    platformLabel: platform ? ADAPTERS[platform]?.label ?? null : null,
    autoApprove: Boolean(partner?.feed_auto_approve),
    lastSyncedAt: partner?.feed_last_synced_at ?? null,
    lastStatus: partner?.feed_last_status ?? null,
    lastError: partner?.feed_last_error ?? null,
    lastCount: partner?.feed_last_count ?? null,
    syncedProductCount: count ?? 0,
  };

  return <StoreClient state={state} />;
}
