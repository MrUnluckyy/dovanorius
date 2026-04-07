import { createClient } from "@/utils/supabase/server";

export default async function PartnerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: partnerUser } = await supabase
    .from("partner_users")
    .select("partner_id")
    .eq("user_id", user!.id)
    .single();

  const partnerId = partnerUser!.partner_id;

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
