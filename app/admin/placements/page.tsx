import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LuPlus } from "react-icons/lu";
import { requireAdmin } from "@/app/admin/_lib/requireAdmin";
import { fmtDate } from "@/app/admin/editorial/_lib/dates";
import { loadPlacements, placementStatus, type PlacementStatus } from "./_lib/load";

export const dynamic = "force-dynamic";

const STATUS: Record<PlacementStatus, { label: string; badge: string }> = {
  live: { label: "Rodoma", badge: "badge-success" },
  scheduled: { label: "Suplanuota", badge: "badge-info" },
  ended: { label: "Baigėsi", badge: "badge-ghost" },
  inactive: { label: "Išjungta", badge: "badge-ghost" },
};

export default async function AdminPlacementsPage() {
  await requireAdmin();
  const [placements, t] = await Promise.all([loadPlacements(), getTranslations("Discover")]);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            Reklama Discover puslapyje{" "}
            <span className="text-lg font-normal text-base-content/65">({placements.length})</span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-base-content/70">
            Remiami blokai rodomi po antros kolekcijos, pažymėti „Remiama“. Viename puslapyje rodoma
            tik viena reklama: tinkanti pagal gavėją ir kategoriją, su didžiausiu prioritetu.
          </p>
        </div>
        <Link href="/admin/placements/new" className="btn btn-primary btn-sm gap-1">
          <LuPlus size={15} /> Nauja reklama
        </Link>
      </div>

      <div className="card mt-6 bg-base-100 card-border">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Reklama</th>
                  <th>Būsena</th>
                  <th>Kur rodoma</th>
                  <th>Rodoma nuo / iki</th>
                  <th className="text-right">Peržiūros</th>
                  <th className="text-right">Paspaudimai</th>
                  <th className="text-right">CTR</th>
                </tr>
              </thead>
              <tbody>
                {placements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-base-content/65">
                      Kol kas nėra reklamų.
                    </td>
                  </tr>
                ) : (
                  placements.map((p) => {
                    const s = STATUS[placementStatus(p)];
                    return (
                      <tr key={p.id}>
                        <td>
                          <Link href={`/admin/placements/${p.id}`} className="font-medium hover:underline">
                            {p.headline}
                          </Link>
                          <div className="text-xs text-base-content/65">{p.advertiser}</div>
                        </td>
                        <td>
                          <span className={`badge badge-sm ${s.badge}`}>{s.label}</span>
                        </td>
                        <td className="text-xs text-base-content/70">
                          {p.recipients.length
                            ? p.recipients.map((r) => t(`recipient.${r}`)).join(", ")
                            : "Visi gavėjai"}
                          {p.categories.length
                            ? ` · ${p.categories.map((c) => t(`category.${c}`)).join(", ")}`
                            : ""}
                        </td>
                        <td className="text-xs text-base-content/70">
                          {fmtDate(p.starts_at)} → {fmtDate(p.ends_at)}
                        </td>
                        <td className="text-right tabular-nums">{p.views}</td>
                        <td className="text-right tabular-nums">{p.clicks}</td>
                        <td className="text-right tabular-nums">
                          {p.views ? `${((100 * p.clicks) / p.views).toFixed(1)} %` : "–"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-base-content/65">
            Peržiūros ir paspaudimai skaičiuojami unikaliais lankytojais per dieną.
          </p>
        </div>
      </div>
    </>
  );
}
