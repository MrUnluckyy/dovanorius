import Link from "next/link";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { requireAdmin } from "@/app/admin/_lib/requireAdmin";

export const dynamic = "force-dynamic";

/**
 * Affiliate income from every network on one page: clicks we sent (our /out
 * log), sales the networks reported (affiliate_transactions, synced nightly),
 * and which wish, Discover product or partner page each sale came from.
 */

const RANGES = [7, 30, 90, 365] as const;
const STATUS_LT: Record<string, string> = {
  pending: "Laukiama",
  approved: "Patvirtinta",
  paid: "Išmokėta",
  declined: "Atmesta",
};
const STATUS_BADGE: Record<string, string> = {
  pending: "badge-warning",
  approved: "badge-success",
  paid: "badge-info",
  declined: "badge-error",
};
const NETWORK_LT: Record<string, string> = { awin: "Awin", cj: "CJ", tradedoubler: "TradeDoubler" };

const eur = (n: number) =>
  new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR" }).format(n);
const pct = (n: number) => `${(n * 100).toLocaleString("lt-LT", { maximumFractionDigits: 1 })} %`;

type Tx = {
  network: string;
  tx_id: string;
  advertiser_id: string | null;
  advertiser_name: string | null;
  status: string;
  sale_amount: number | null;
  commission: number | null;
  currency: string | null;
  click_ref: string | null;
  transacted_at: string;
  synced_at: string;
};

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  await requireAdmin();
  const { d } = await searchParams;
  const days = RANGES.find((r) => String(r) === d) ?? 30;
  const since = new Date(Date.now() - days * 864e5).toISOString();

  const [{ data: txData }, { data: clickCounts }, { data: merchants }, { data: lastSync }] =
    await Promise.all([
      supabaseAdmin
        .from("affiliate_transactions")
        .select(
          "network, tx_id, advertiser_id, advertiser_name, status, sale_amount, commission, currency, click_ref, transacted_at, synced_at"
        )
        .gte("transacted_at", since)
        .order("transacted_at", { ascending: false })
        .limit(5000),
      supabaseAdmin.rpc("affiliate_click_counts", { p_since: since }),
      supabaseAdmin.from("affiliate_merchants").select("id, name, network, network_advertiser_id"),
      supabaseAdmin
        .from("affiliate_transactions")
        .select("network, synced_at")
        .order("synced_at", { ascending: false })
        .limit(200),
    ]);

  const txs = (txData ?? []) as Tx[];
  const merchantList = merchants ?? [];

  // ── Per shop: clicks (our log, by merchant) joined to sales (by network id).
  type ShopRow = {
    key: string;
    name: string;
    network: string;
    clicks: number;
    sales: number;
    revenue: number;
    pending: number;
    earned: number; // approved + paid
  };
  const rows = new Map<string, ShopRow>();
  const keyOf = (network: string, advertiserId: string | null) => `${network}:${advertiserId ?? "?"}`;
  const row = (key: string, name: string, network: string) => {
    if (!rows.has(key))
      rows.set(key, { key, name, network, clicks: 0, sales: 0, revenue: 0, pending: 0, earned: 0 });
    return rows.get(key)!;
  };
  const merchantById = new Map(merchantList.map((m) => [m.id, m]));
  for (const c of clickCounts ?? []) {
    const m = merchantById.get(c.merchant_id);
    if (!m) continue;
    row(keyOf(m.network, m.network_advertiser_id), m.name, m.network).clicks += Number(c.clicks);
  }
  const nameByKey = new Map(merchantList.map((m) => [keyOf(m.network, m.network_advertiser_id), m.name]));
  for (const t of txs) {
    const key = keyOf(t.network, t.advertiser_id);
    const r = row(key, nameByKey.get(key) ?? t.advertiser_name ?? `#${t.advertiser_id}`, t.network);
    if (t.status === "declined") continue;
    r.sales += 1;
    r.revenue += t.sale_amount ?? 0;
    if (t.status === "pending") r.pending += t.commission ?? 0;
    else r.earned += t.commission ?? 0;
  }
  const shops = [...rows.values()].sort(
    (a, b) => b.pending + b.earned - (a.pending + a.earned) || b.clicks - a.clicks
  );

  const totals = shops.reduce(
    (s, r) => ({
      clicks: s.clicks + r.clicks,
      sales: s.sales + r.sales,
      revenue: s.revenue + r.revenue,
      pending: s.pending + r.pending,
      earned: s.earned + r.earned,
    }),
    { clicks: 0, sales: 0, revenue: 0, pending: 0, earned: 0 }
  );
  const declined = txs.filter((t) => t.status === "declined").length;

  // ── Where each sale came from: its click's wish, Discover product or partner.
  const refs = [...new Set(txs.map((t) => t.click_ref).filter((r): r is string => !!r))];
  const { data: clicks } = refs.length
    ? await supabaseAdmin
        .from("affiliate_clicks")
        .select("sub_id, item_id, product_id, partner_id")
        .in("sub_id", refs.slice(0, 500))
    : { data: [] };
  const clickByRef = new Map((clicks ?? []).map((c) => [c.sub_id, c]));
  const itemIds = [...new Set((clicks ?? []).map((c) => c.item_id).filter(Boolean))];
  const productIds = [...new Set((clicks ?? []).map((c) => c.product_id).filter(Boolean))];
  const [{ data: items }, { data: products }] = await Promise.all([
    itemIds.length
      ? supabaseAdmin.from("items").select("id, title, board_id").in("id", itemIds)
      : Promise.resolve({ data: [] as { id: string; title: string; board_id: string }[] }),
    productIds.length
      ? supabaseAdmin.from("inspo_products").select("id, product_name").in("id", productIds)
      : Promise.resolve({ data: [] as { id: string; product_name: string }[] }),
  ]);
  const itemById = new Map((items ?? []).map((i) => [i.id, i]));
  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const sourceOf = (t: Tx): { label: string; detail: string | null } => {
    const c = t.click_ref ? clickByRef.get(t.click_ref) : null;
    if (!c) {
      if (!t.click_ref) return { label: "Be žymos", detail: null };
      // Not one of our /out ids: a link tagged by hand (e.g. epi(janome-sale)).
      if (!/^[0-9a-f-]{36}$/i.test(t.click_ref)) return { label: "Rankinė žyma", detail: t.click_ref };
      return { label: "Nerastas paspaudimas", detail: null };
    }
    if (c.item_id) return { label: "Noras", detail: itemById.get(c.item_id)?.title ?? null };
    if (c.product_id) return { label: "Idėjos", detail: productById.get(c.product_id)?.product_name ?? null };
    if (c.partner_id) return { label: "Partneris", detail: null };
    return { label: "Nuoroda", detail: null };
  };

  // ── Last successful sync per network.
  const synced = new Map<string, string>();
  for (const s of lastSync ?? []) if (!synced.has(s.network)) synced.set(s.network, s.synced_at);

  const card = (label: string, value: string, hint?: string) => (
    <div className="card bg-base-100 card-border">
      <div className="card-body gap-1 p-4">
        <p className="text-xs uppercase tracking-wide text-base-content/60">{label}</p>
        <p className="font-heading text-2xl font-bold">{value}</p>
        {hint && <p className="text-xs text-base-content/60">{hint}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Pajamos</h1>
          <p className="text-sm text-base-content/70">
            Paspaudimai iš Noriuto ir pardavimai, kuriuos pranešė Awin, CJ ir TradeDoubler. Atnaujinama kas
            naktį; būsenos (laukiama → patvirtinta → išmokėta) keičiasi kelias savaites.
          </p>
        </div>
        <div role="group" className="join">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/pajamos?d=${r}`}
              className={`btn join-item btn-sm ${r === days ? "btn-neutral" : "btn-ghost"}`}
            >
              {r === 365 ? "Metai" : `${r} d.`}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {card("Paspaudimai", totals.clicks.toLocaleString("lt-LT"))}
        {card(
          "Pardavimai",
          totals.sales.toLocaleString("lt-LT"),
          totals.clicks ? `konversija ${pct(totals.sales / totals.clicks)}` : undefined
        )}
        {card("Apyvarta", eur(totals.revenue), "parduotuvėse per mūsų nuorodas")}
        {card("Komisinis laukiamas", eur(totals.pending), declined ? `atmesta: ${declined}` : undefined)}
        {card(
          "Komisinis patvirtintas",
          eur(totals.earned),
          totals.clicks ? `${eur((totals.pending + totals.earned) / totals.clicks)} už paspaudimą` : undefined
        )}
      </div>

      <section className="card bg-base-100 card-border">
        <div className="card-body">
          <h2 className="font-heading text-lg font-bold">Pagal parduotuvę</h2>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Parduotuvė</th>
                  <th>Tinklas</th>
                  <th className="text-right">Paspaudimai</th>
                  <th className="text-right">Pardavimai</th>
                  <th className="text-right">Konversija</th>
                  <th className="text-right">Apyvarta</th>
                  <th className="text-right">Laukiama</th>
                  <th className="text-right">Patvirtinta</th>
                  <th className="text-right">Už paspaudimą</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((r) => (
                  <tr key={r.key}>
                    <td className="font-medium">{r.name}</td>
                    <td>{NETWORK_LT[r.network] ?? r.network}</td>
                    <td className="text-right">{r.clicks.toLocaleString("lt-LT")}</td>
                    <td className="text-right">{r.sales}</td>
                    <td className="text-right">{r.clicks ? pct(r.sales / r.clicks) : "—"}</td>
                    <td className="text-right">{eur(r.revenue)}</td>
                    <td className="text-right">{eur(r.pending)}</td>
                    <td className="text-right">{eur(r.earned)}</td>
                    <td className="text-right">{r.clicks ? eur((r.pending + r.earned) / r.clicks) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card bg-base-100 card-border">
        <div className="card-body">
          <h2 className="font-heading text-lg font-bold">Naujausi pardavimai</h2>
          {txs.length === 0 ? (
            <p className="text-sm text-base-content/65">Šiuo laikotarpiu pardavimų nėra.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Parduotuvė</th>
                    <th>Šaltinis</th>
                    <th className="text-right">Suma</th>
                    <th className="text-right">Komisinis</th>
                    <th>Būsena</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.slice(0, 100).map((t) => {
                    const src = sourceOf(t);
                    const key = keyOf(t.network, t.advertiser_id);
                    return (
                      <tr key={`${t.network}-${t.tx_id}`} className={t.status === "declined" ? "opacity-50" : undefined}>
                        <td className="whitespace-nowrap">{t.transacted_at.slice(0, 10)}</td>
                        <td>
                          {nameByKey.get(key) ?? t.advertiser_name ?? `#${t.advertiser_id}`}
                          <span className="ml-1 text-xs text-base-content/55">{NETWORK_LT[t.network]}</span>
                        </td>
                        <td>
                          <span className="font-medium">{src.label}</span>
                          {src.detail && (
                            <span className="ml-1 text-xs text-base-content/60">{src.detail.slice(0, 60)}</span>
                          )}
                        </td>
                        <td className="text-right">
                          {t.sale_amount != null ? (t.currency && t.currency !== "EUR" ? `${t.sale_amount} ${t.currency}` : eur(t.sale_amount)) : "—"}
                        </td>
                        <td className="text-right">
                          {t.commission != null ? (t.currency && t.currency !== "EUR" ? `${t.commission} ${t.currency}` : eur(t.commission)) : "—"}
                        </td>
                        <td>
                          <span className={`badge badge-sm ${STATUS_BADGE[t.status] ?? ""}`}>
                            {STATUS_LT[t.status] ?? t.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <p className="text-xs text-base-content/60">
        Naujausias pardavimų įrašas:{" "}
        {["awin", "cj", "tradedoubler"]
          .map((n) =>
            `${NETWORK_LT[n]} ${synced.get(n) ? new Date(synced.get(n)!).toLocaleString("lt-LT") : "pardavimų dar nėra"}`
          )
          .join(" · ")}
      </p>
    </div>
  );
}
