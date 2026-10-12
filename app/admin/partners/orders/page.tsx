import { supabaseAdmin } from "@/utils/supabase/admin";
import { fmtEur, loadTracking, TRACKING_DAYS } from "@/lib/partner/tracking";
import { OrdersTrackingClient, type TrackingRow } from "./_components/OrdersTrackingClient";

export const dynamic = "force-dynamic";

/**
 * Purchase tracking per direct partner: clicks we sent (from /out), orders
 * their shop reported back through the webhook, and the setup that connects
 * the two. Only Shopify for now.
 */
export default async function PartnerOrdersPage() {
  const [{ data: partners }, { data: secrets }, { data: recent }] = await Promise.all([
    supabaseAdmin
      .from("partners")
      .select("id, name, feed_platform, store_domain, orders_webhook_last_at")
      .order("name"),
    // Which partners have a key — never the key itself.
    supabaseAdmin.from("partner_webhook_secrets").select("partner_id").eq("platform", "shopify"),
    supabaseAdmin
      .from("partner_orders")
      .select("id, partner_id, order_name, total, currency, ordered_at, attributed_by, cancelled_at")
      .order("ordered_at", { ascending: false })
      .limit(20),
  ]);

  const list = partners ?? [];
  const connected = new Set((secrets ?? []).map((s) => s.partner_id));
  const tracking = await loadTracking(list.map((p) => p.id));
  const nameById = new Map(list.map((p) => [p.id, p.name]));

  const rows: TrackingRow[] = list.map((p) => ({
    id: p.id,
    name: p.name,
    platform: p.feed_platform,
    storeDomain: p.store_domain,
    hasSecret: connected.has(p.id),
    lastDeliveryAt: p.orders_webhook_last_at,
    ...tracking.get(p.id)!,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Partnerių užsakymai</h1>
        <p className="text-sm text-base-content/60">
          Paspaudimai į partnerių parduotuves ir užsakymai, kuriuos jų Shopify
          atsiuntė atgal. Paskutinės {TRACKING_DAYS} dienų.
        </p>
      </div>

      <OrdersTrackingClient rows={rows} />

      <section className="card bg-base-100 card-border">
        <div className="card-body">
          <h2 className="font-heading text-lg font-bold">Naujausi užsakymai</h2>
          {(recent ?? []).length === 0 ? (
            <p className="text-sm text-base-content/50">
              Dar nėra užsakymų iš Noriuto nuorodų.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Partneris</th>
                    <th>Užsakymas</th>
                    <th className="text-right">Suma</th>
                    <th>Data</th>
                    <th>Priskirta pagal</th>
                  </tr>
                </thead>
                <tbody>
                  {(recent ?? []).map((o) => (
                    <tr key={o.id} className={o.cancelled_at ? "opacity-50" : undefined}>
                      <td>{nameById.get(o.partner_id) ?? "—"}</td>
                      <td>
                        {o.order_name ?? "—"}
                        {o.cancelled_at && (
                          <span className="badge badge-ghost badge-xs ml-2">atšauktas</span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">
                        {o.currency === "EUR"
                          ? fmtEur(Number(o.total))
                          : `${o.total} ${o.currency}`}
                      </td>
                      <td className="text-sm text-base-content/60">
                        {new Date(o.ordered_at).toLocaleString("lt-LT")}
                      </td>
                      <td className="text-xs text-base-content/60">
                        {o.attributed_by === "nr_click" ? "paspaudimą" : "UTM žymą"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
