import { redirect } from "next/navigation";
import { getPartnerContext } from "@/lib/partner/context";
import { fmtEur, loadTracking, TRACKING_DAYS } from "@/lib/partner/tracking";

export default async function PartnerDashboardPage() {
  const ctx = await getPartnerContext();
  if (!ctx) redirect("/dashboard");

  const { supabase } = ctx;
  const partnerId = ctx.active.partnerId;

  // ctx.active is a membership the caller actually holds, which is what makes
  // the service-role read inside loadTracking safe to show here.
  const [{ count: productCount }, { count: memberCount }, tracking] = await Promise.all([
    supabase
      .from("partner_products")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", partnerId),
    supabase
      .from("partner_users")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", partnerId),
    loadTracking([partnerId]).then((m) => m.get(partnerId)!),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">Apžvalga</h1>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-base-content/60">
          Iš Noriuto per paskutines {TRACKING_DAYS} dienų
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Paspaudimai į jūsų parduotuvę" value={String(tracking.clicks)} />
          <Stat label="Užsakymai" value={String(tracking.orders)} />
          <Stat label="Pardavimai" value={fmtEur(tracking.sales)} />
        </div>
        {tracking.clicks > 0 && tracking.orders === 0 && (
          <p className="mt-2 text-xs text-base-content/50">
            Užsakymai rodomi, kai jūsų Shopify prijungta prie Noriuto. Norėdami
            įjungti, susisiekite su mumis.
          </p>
        )}
      </section>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card bg-base-100 card-border">
      <div className="card-body">
        <p className="text-sm text-base-content/60">{label}</p>
        <p className="text-4xl font-bold font-heading tabular-nums">{value}</p>
      </div>
    </div>
  );
}
