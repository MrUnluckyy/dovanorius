"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuTrash2 } from "react-icons/lu";
import toast from "react-hot-toast";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { ltPlural } from "@/lib/lt-plural";
import { removeSearchTerms } from "../actions";

export type StatRow = {
  term: string;
  searches: number;
  zero_share: number;
  avg_results: number;
  last_at: string;
};

/**
 * One reading of search_stats, with removal: tick junk phrases (testers typing
 * an email into the product search, one row per keystroke) and delete them
 * from search_log.
 */
export function StatTable({
  title,
  hint,
  rows,
}: {
  title: string;
  hint: string;
  rows: StatRow[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const router = useRouter();

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.term));

  function toggle(term: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      return next;
    });
  }

  async function remove(terms: string[]) {
    const label =
      terms.length === 1
        ? `„${terms[0]}“`
        : `${terms.length} ${ltPlural(terms.length, "frazė", "frazės", "frazių")}`;
    const ok = await confirm({
      title: "Pašalinti iš statistikos?",
      message: `${label}: visos šių frazių paieškos bus ištrintos visam laikui, ne tik pasirinktame laikotarpyje.`,
      confirmText: "Pašalinti",
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await removeSearchTerms(terms);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Pašalinta ${res.removed} ${ltPlural(res.removed, "paieška", "paieškos", "paieškų")}.`
      );
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <section className="card bg-base-100 card-border">
      <div className="card-body">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-heading text-lg font-bold">{title}</h2>
            <p className="mb-2 text-xs text-base-content/50">{hint}</p>
          </div>
          {selected.size > 0 && (
            <button
              className="btn btn-error btn-sm gap-1"
              onClick={() => remove(Array.from(selected))}
              disabled={pending}
            >
              <LuTrash2 size={14} /> Pašalinti pažymėtas ({selected.size})
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th className="w-px">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={allChecked}
                    disabled={rows.length === 0}
                    onChange={() =>
                      setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.term)))
                    }
                    aria-label="Pažymėti visas"
                  />
                </th>
                <th>Frazė</th>
                <th className="text-right">Paieškos</th>
                <th className="text-right">Be rezultatų</th>
                <th className="text-right">Vid. rezultatų</th>
                <th className="text-right">Paskutinį kartą</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-base-content/40">
                    —
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.term} className={selected.has(r.term) ? "bg-base-200" : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={selected.has(r.term)}
                        onChange={() => toggle(r.term)}
                        aria-label={`Pažymėti „${r.term}“`}
                      />
                    </td>
                    <td className="font-medium">
                      <Link
                        href={`/discover/browse?q=${encodeURIComponent(r.term)}`}
                        target="_blank"
                        className="link-hover cursor-pointer"
                      >
                        {r.term}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">{r.searches}</td>
                    <td className="text-right tabular-nums">
                      {Math.round(r.zero_share * 100)}%
                    </td>
                    <td className="text-right tabular-nums">
                      {/* results are capped at 601 in search_products */}
                      {r.avg_results >= 600 ? "600+" : r.avg_results}
                    </td>
                    <td className="text-right text-xs text-base-content/60">
                      {new Date(r.last_at).toLocaleDateString("lt-LT")}
                    </td>
                    <td className="w-px text-right">
                      <button
                        className="btn btn-ghost btn-xs text-base-content/40 hover:text-error"
                        onClick={() => remove([r.term])}
                        disabled={pending}
                        title="Pašalinti iš statistikos"
                        aria-label={`Pašalinti „${r.term}“ iš statistikos`}
                      >
                        <LuTrash2 size={13} />
                      </button>
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
