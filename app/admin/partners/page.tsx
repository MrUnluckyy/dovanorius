import { supabaseAdmin } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

type Partner = {
  id: string;
  name: string;
  slug: string | null;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
};

export default async function AdminPartnersPage() {
  const [partners, users, products] = await Promise.all([
    supabaseAdmin
      .from("partners")
      .select("id, name, slug, website_url, is_active, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("partner_users").select("partner_id"),
    supabaseAdmin.from("partner_products").select("partner_id, is_active"),
  ]);

  const partnerRows = (partners.data ?? []) as Partner[];
  const members = new Map<string, number>();
  for (const u of users.data ?? []) {
    members.set(u.partner_id, (members.get(u.partner_id) ?? 0) + 1);
  }
  const productCounts = new Map<string, number>();
  for (const p of products.data ?? []) {
    if (p.is_active === false) continue;
    productCounts.set(p.partner_id, (productCounts.get(p.partner_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">
          Partneriai{" "}
          <span className="text-lg font-normal text-base-content/40">
            ({partnerRows.length})
          </span>
        </h1>
        <p className="mt-1 text-sm text-base-content/60">
          Partnerių portalo paskyros (savo produktus įkeliantys partneriai).
        </p>
      </div>

      <div className="alert alert-warning text-sm">
        Portalo partnerių produktai kol kas nerodomi Discover sraute ir nėra
        stebimi — įtraukimo analitika bus prieinama, kai jie bus įtraukti į
        srautą.
      </div>

      <div className="card bg-base-100 card-border">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Partneris</th>
                  <th>Būsena</th>
                  <th className="text-right">Produktai</th>
                  <th className="text-right">Nariai</th>
                  <th>Sukurta</th>
                </tr>
              </thead>
              <tbody>
                {partnerRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-base-content/40">
                      Kol kas nėra partnerių.
                    </td>
                  </tr>
                ) : (
                  partnerRows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="font-medium">{p.name}</div>
                        {p.website_url && (
                          <a
                            href={p.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-base-content/50 hover:underline"
                          >
                            {p.website_url.replace(/^https?:\/\//, "")}
                          </a>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge badge-sm ${
                            p.is_active ? "badge-success" : "badge-ghost"
                          }`}
                        >
                          {p.is_active ? "Aktyvus" : "Neaktyvus"}
                        </span>
                      </td>
                      <td className="text-right tabular-nums">
                        {productCounts.get(p.id) ?? 0}
                      </td>
                      <td className="text-right tabular-nums">
                        {members.get(p.id) ?? 0}
                      </td>
                      <td className="text-sm text-base-content/60">
                        {new Date(p.created_at).toLocaleDateString("lt-LT")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
