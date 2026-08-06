import { redirect } from "next/navigation";
import { getPartnerContext } from "@/lib/partner/context";

export default async function PartnerDashboardPage() {
  const ctx = await getPartnerContext();
  if (!ctx) redirect("/dashboard");

  const { supabase } = ctx;
  const partnerId = ctx.active.partnerId;

  const [{ count: productCount }, { count: memberCount }] = await Promise.all([
    supabase
      .from("partner_products")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", partnerId),
    supabase
      .from("partner_users")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", partnerId),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">Apžvalga</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="card bg-base-100 card-border">
          <div className="card-body">
            <p className="text-sm text-base-content/60">Produktai</p>
            <p className="text-4xl font-bold font-heading">{productCount ?? 0}</p>
          </div>
        </div>
        <div className="card bg-base-100 card-border">
          <div className="card-body">
            <p className="text-sm text-base-content/60">Nariai</p>
            <p className="text-4xl font-bold font-heading">{memberCount ?? 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
