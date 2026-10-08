import Link from "next/link";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { StatTable, type StatRow } from "./_components/StatTable";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

/** Under this many results a search is "thinly served": worth a partner. */
const THIN = 10;

const n = (v: unknown) => Number(v ?? 0);

/**
 * What people search for, from search_log (written by search_products on web
 * and app). Two readings of the same rows:
 *
 *  - most searched: demand we already serve;
 *  - searched but empty or thin: demand nobody in the catalogue serves yet,
 *    which is the list to take to prospective partners.
 *
 * search_stats() is service-role only; AdminLayout has checked is_admin.
 */
export default async function AdminSearchesPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = RANGES.find((d) => String(d) === daysParam) ?? 30;

  const { data, error } = await supabaseAdmin.rpc("search_stats", {
    p_days: days,
    p_limit: 500,
  });

  if (error) {
    return <p className="text-error">Nepavyko įkelti paieškų: {error.message}</p>;
  }

  const rows = ((data ?? []) as StatRow[]).map((r) => ({
    ...r,
    searches: n(r.searches),
    zero_share: n(r.zero_share),
    avg_results: n(r.avg_results),
  }));

  const total = rows.reduce((s, r) => s + r.searches, 0);
  const zeroSearches = rows.reduce((s, r) => s + Math.round(r.searches * r.zero_share), 0);
  const top = rows.slice(0, 50);
  const gaps = rows
    .filter((r) => r.zero_share >= 0.5 || r.avg_results < THIN)
    .slice(0, 50);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Paieškos</h1>
          <p className="text-sm text-base-content/60">
            Ko ieško naudotojai (svetainė ir programėlė). Be naudotojų ID — tik sumos.
          </p>
        </div>
        <div className="join">
          {RANGES.map((d) => (
            <Link
              key={d}
              href={`/admin/searches?days=${d}`}
              className={`btn join-item btn-sm cursor-pointer ${d === days ? "btn-primary" : ""}`}
            >
              {d} d.
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Kpi label="Paieškos" value={total} />
        <Kpi label="Skirtingos frazės" value={rows.length} />
        <Kpi
          label="Be rezultatų"
          value={total > 0 ? `${Math.round((100 * zeroSearches) / total)}%` : "—"}
        />
      </div>

      {total === 0 && (
        <div className="alert alert-info text-sm">
          Kol kas paieškų nėra — jos kaupsis, kai naudotojai ieškos prekių.
        </div>
      )}

      <StatTable
        title="Paklausa be pasiūlos"
        hint={`Ieškoma, bet nerandama arba randama mažiau nei ${THIN} prekių. Tai sąrašas pokalbiams su partneriais: paklausa, kurios katalogas dar neaptarnauja.`}
        rows={gaps}
      />

      <StatTable
        title="Dažniausios paieškos"
        hint="Paklausa, kurią jau aptarnaujame."
        rows={top}
      />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card bg-base-100 card-border">
      <div className="card-body p-4">
        <span className="text-xs text-base-content/60">{label}</span>
        <span className="font-heading text-2xl font-bold tabular-nums">{value}</span>
      </div>
    </div>
  );
}
