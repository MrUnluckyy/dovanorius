import { supabaseAdmin } from "@/utils/supabase/admin";
import { QueueActions } from "./_components/QueueActions";
import {
  QueueBulkActions,
  type PendingPartner,
} from "./_components/QueueBulkActions";

export const dynamic = "force-dynamic";

type PendingProduct = {
  id: string;
  partner_id: string;
  title: string;
  price: number | null;
  currency: string;
  image_url: string | null;
  product_url: string | null;
  categories: string[];
  created_at: string;
};

export default async function PartnerModerationPage() {
  const { data: products } = await supabaseAdmin
    .from("partner_products")
    .select(
      "id, partner_id, title, price, currency, image_url, product_url, categories, created_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const rows = (products ?? []) as PendingProduct[];

  // Resolve partner names in one round-trip.
  const partnerIds = [...new Set(rows.map((r) => r.partner_id))];
  const names = new Map<string, string>();
  if (partnerIds.length > 0) {
    const { data: partners } = await supabaseAdmin
      .from("partners")
      .select("id, name")
      .in("id", partnerIds);
    for (const p of partners ?? []) names.set(p.id, p.name);
  }

  // Pending counts per partner, so the bulk action can be scoped to one of them.
  const pendingPartners: PendingPartner[] = partnerIds
    .map((id) => ({
      id,
      name: names.get(id) ?? "—",
      count: rows.filter((r) => r.partner_id === id).length,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            Moderavimas{" "}
            <span className="text-lg font-normal text-base-content/40">
              ({rows.length})
            </span>
          </h1>
          <p className="mt-1 text-sm text-base-content/60">
            Partnerių įkelti produktai, laukiantys peržiūros. Patvirtinti
            produktai iškart įtraukiami į Discover srautą.
          </p>
        </div>
        <QueueBulkActions partners={pendingPartners} total={rows.length} />
      </div>

      {rows.length === 0 ? (
        <div className="card bg-base-100 card-border">
          <div className="card-body items-center py-16 text-center text-base-content/50">
            <p>Peržiūros eilė tuščia. 🎉</p>
          </div>
        </div>
      ) : (
        <div className="card bg-base-100 card-border">
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Produktas</th>
                    <th>Partneris</th>
                    <th className="text-right">Kaina</th>
                    <th>Įkelta</th>
                    <th className="w-48"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const missingUrl = !p.product_url;
                    return (
                      <tr key={p.id} className="hover">
                        <td>
                          <div className="flex items-center gap-3">
                            {p.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.image_url}
                                alt={p.title}
                                className="h-10 w-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 shrink-0 rounded-lg bg-base-200" />
                            )}
                            <div>
                              <p className="line-clamp-1 text-sm font-medium">
                                {p.title}
                              </p>
                              {p.product_url ? (
                                <a
                                  href={p.product_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline"
                                >
                                  {p.product_url.replace(/^https?:\/\//, "").slice(0, 40)}
                                </a>
                              ) : (
                                <span className="text-xs text-warning">
                                  Nėra nuorodos — nebus rodomas sraute
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-sm">
                          {names.get(p.partner_id) ?? "—"}
                        </td>
                        <td className="text-right text-sm tabular-nums">
                          {p.price != null
                            ? `${Number(p.price).toFixed(2)} ${p.currency}`
                            : "—"}
                        </td>
                        <td className="text-sm text-base-content/60">
                          {new Date(p.created_at).toLocaleDateString("lt-LT")}
                        </td>
                        <td>
                          <QueueActions productId={p.id} />
                          {missingUrl && (
                            <p className="mt-1 text-right text-[10px] text-base-content/40">
                              Patvirtinus vis tiek nebus rodomas be nuorodos
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
