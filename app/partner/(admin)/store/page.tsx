import { redirect } from "next/navigation";
import { getPartnerContext } from "@/lib/partner/context";
import { supabaseAdmin } from "@/utils/supabase/admin";
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
        "shopify_domain, feed_auto_approve, feed_last_synced_at, feed_last_status, feed_last_error, feed_last_count"
      )
      .eq("id", partnerId)
      .single(),
    supabaseAdmin
      .from("partner_products")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partnerId)
      .eq("source", "shopify"),
  ]);

  const state: StoreState = {
    domain: partner?.shopify_domain ?? null,
    autoApprove: Boolean(partner?.feed_auto_approve),
    lastSyncedAt: partner?.feed_last_synced_at ?? null,
    lastStatus: partner?.feed_last_status ?? null,
    lastError: partner?.feed_last_error ?? null,
    lastCount: partner?.feed_last_count ?? null,
    syncedProductCount: count ?? 0,
  };

  return <StoreClient state={state} />;
}
