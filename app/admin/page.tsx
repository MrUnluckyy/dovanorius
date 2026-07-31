import { supabaseAdmin } from "@/utils/supabase/admin";
import { LuEye, LuBookmark, LuExternalLink } from "react-icons/lu";

export const dynamic = "force-dynamic";

type MerchantRow = {
  merchant_name: string;
  opens: number;
  saves: number;
  clicks: number;
  save_rate_pct: number | null;
  click_rate_pct: number | null;
};
type CatalogRow = { merchant_name: string; catalog_n: number };
type BrandRow = { brand_name: string; opens: number; saves: number; clicks: number };
type TypeRow = { product_type: string; opens: number; saves: number; clicks: number };

const n = (v: unknown) => Number(v ?? 0);
const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((100 * part) / whole) : 0;

export default async function AdminAnalyticsPage() {
  const [merchants, catalog, brands, types] = await Promise.all([
    supabaseAdmin.from("inspo_merchant_funnel").select("*"),
    supabaseAdmin.from("inspo_catalog_by_merchant").select("*"),
    supabaseAdmin.from("inspo_brand_funnel").select("*").limit(12),
    supabaseAdmin.from("inspo_type_funnel").select("*"),
  ]);

  const merchantRows = (merchants.data ?? []) as MerchantRow[];
  const catalogRows = (catalog.data ?? []) as CatalogRow[];
  const brandRows = (brands.data ?? []) as BrandRow[];
  const typeRows = (types.data ?? []) as TypeRow[];

  const totalOpens = merchantRows.reduce((s, r) => s + n(r.opens), 0);
  const totalSaves = merchantRows.reduce((s, r) => s + n(r.saves), 0);
  const totalClicks = merchantRows.reduce((s, r) => s + n(r.clicks), 0);
  const totalCatalog = catalogRows.reduce((s, r) => s + n(r.catalog_n), 0);
  const catalogByMerchant = new Map(
    catalogRows.map((r) => [r.merchant_name, n(r.catalog_n)])
  );

  const hasData = totalOpens + totalSaves + totalClicks > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">Analitika</h1>
        <p className="mt-1 text-sm text-base-content/60">
          Discover srauto įtraukimas (peržiūros → išsaugojimai → paspaudimai).
        </p>
      </div>

      {!hasData && (
        <div className="alert alert-info text-sm">
          Kol kas nėra įtraukimo duomenų — jie kaupsis, kai naudotojai naršys
          Discover. Struktūra paruošta.
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi icon={<LuEye />} label="Peržiūros" value={totalOpens} />
        <Kpi icon={<LuBookmark />} label="Išsaugojimai" value={totalSaves} />
        <Kpi icon={<LuExternalLink />} label="Paspaudimai" value={totalClicks} />
        <Kpi
          label="Paspaudimų dažnis"
          value={`${pct(totalClicks, totalOpens)}%`}
        />
      </div>

      {/* Merchant funnel + share comparison */}
      <section className="card bg-base-100 card-border">
        <div className="card-body">
          <h2 className="font-heading text-lg font-bold">Pardavėjai</h2>
          <p className="-mt-1 mb-2 text-xs text-base-content/50">
            Įtraukimo dalis vs. katalogo dalis — rodo, kurie pardavėjai viršija
            arba nepasiekia savo katalogo dydžio.
          </p>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Pardavėjas</th>
                  <th className="text-right">Katalogo dalis</th>
                  <th className="text-right">Peržiūros</th>
                  <th className="text-right">Išsaug.</th>
                  <th className="text-right">Paspaud.</th>
                  <th className="text-right">Pasp. dalis</th>
                  <th className="text-right">Indeksas</th>
                </tr>
              </thead>
              <tbody>
                {merchantRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-base-content/40">
                      —
                    </td>
                  </tr>
                ) : (
                  merchantRows.map((r) => {
                    const catShare = pct(
                      catalogByMerchant.get(r.merchant_name) ?? 0,
                      totalCatalog
                    );
                    const clickShare = pct(n(r.clicks), totalClicks);
                    const index =
                      catShare > 0 ? clickShare / catShare : null;
                    return (
                      <tr key={r.merchant_name}>
                        <td className="font-medium">{r.merchant_name}</td>
                        <td className="text-right tabular-nums">{catShare}%</td>
                        <td className="text-right tabular-nums">{n(r.opens)}</td>
                        <td className="text-right tabular-nums">{n(r.saves)}</td>
                        <td className="text-right tabular-nums font-semibold">
                          {n(r.clicks)}
                        </td>
                        <td className="text-right tabular-nums">{clickShare}%</td>
                        <td className="text-right tabular-nums">
                          {index == null ? (
                            "—"
                          ) : (
                            <span
                              className={
                                index >= 1.1
                                  ? "text-success"
                                  : index <= 0.9
                                    ? "text-error"
                                    : "opacity-60"
                              }
                            >
                              {index.toFixed(2)}×
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category split */}
        <FunnelTable
          title="Kategorijos"
          nameHeader="Kategorija"
          rows={typeRows.map((r) => ({
            name: r.product_type,
            opens: n(r.opens),
            saves: n(r.saves),
            clicks: n(r.clicks),
          }))}
        />
        {/* Top brands */}
        <FunnelTable
          title="Populiariausi prekės ženklai"
          nameHeader="Prekės ženklas"
          rows={brandRows.map((r) => ({
            name: r.brand_name,
            opens: n(r.opens),
            saves: n(r.saves),
            clicks: n(r.clicks),
          }))}
        />
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="card bg-base-100 card-border">
      <div className="card-body p-4">
        <p className="flex items-center gap-1.5 text-xs text-base-content/60">
          {icon}
          {label}
        </p>
        <p className="font-heading text-3xl font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function FunnelTable({
  title,
  nameHeader,
  rows,
}: {
  title: string;
  nameHeader: string;
  rows: { name: string; opens: number; saves: number; clicks: number }[];
}) {
  return (
    <section className="card bg-base-100 card-border">
      <div className="card-body">
        <h2 className="font-heading text-lg font-bold">{title}</h2>
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>{nameHeader}</th>
                <th className="text-right">Perž.</th>
                <th className="text-right">Išsaug.</th>
                <th className="text-right">Paspaud.</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-base-content/40">
                    —
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.name}>
                    <td className="font-medium">{r.name}</td>
                    <td className="text-right tabular-nums">{r.opens}</td>
                    <td className="text-right tabular-nums">{r.saves}</td>
                    <td className="text-right tabular-nums font-semibold">
                      {r.clicks}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
