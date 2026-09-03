"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuCheck, LuMessageSquare, LuTriangleAlert } from "react-icons/lu";
import { markHandled } from "../actions";

export type ReportRow = {
  id: string;
  created_at: string;
  kind: "error" | "report";
  area: string;
  reason: string | null;
  detail: Record<string, unknown> | null;
  path: string | null;
  user_agent: string | null;
  is_guest: boolean | null;
  message: string | null;
  contact_email: string | null;
  handled_at: string | null;
};

export function ReportsList({
  rows,
  showAll,
  pendingMessages,
}: {
  rows: ReportRow[];
  showAll: boolean;
  pendingMessages: number;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handle = async (id: string) => {
    setBusyId(id);
    await markHandled(id);
    setBusyId(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Pranešimai</h1>
          <p className="text-sm text-base-content/60">
            {rows.length} {showAll ? "iš viso" : "neperžiūrėtų"}
            {pendingMessages > 0 && ` · ${pendingMessages} su žinute`}
          </p>
        </div>
        <div role="tablist" className="tabs tabs-box">
          <Link
            href="/admin/reports"
            role="tab"
            className={`tab${!showAll ? " tab-active" : ""}`}
          >
            Neperžiūrėti
          </Link>
          <Link
            href="/admin/reports?show=all"
            role="tab"
            className={`tab${showAll ? " tab-active" : ""}`}
          >
            Visi
          </Link>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="rounded-xl border border-base-300 bg-base-100 p-8 text-center">
          <p className="font-medium">Tylu.</p>
          <p className="mt-1 text-sm text-base-content/60">
            Nieko naujo nuo paskutinio karto — tai gera žinia.
          </p>
        </div>
      )}

      {rows.map((r) => (
        <div
          key={r.id}
          className={`rounded-xl border bg-base-100 p-4 ${
            r.handled_at ? "border-base-300 opacity-60" : "border-base-300"
          }`}
        >
          <div className="flex flex-wrap items-start gap-3">
            {r.kind === "report" ? (
              <LuMessageSquare className="mt-0.5 shrink-0 text-lg text-primary" />
            ) : (
              <LuTriangleAlert className="mt-0.5 shrink-0 text-lg text-warning" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {r.area}
                {r.reason && (
                  <span className="font-normal text-base-content/60">
                    {" "}
                    · {r.reason}
                  </span>
                )}
              </p>

              {/* A person's own words are the only thing here no beacon knows. */}
              {r.message && (
                <p className="mt-2 rounded-lg bg-base-200 p-3 text-sm">
                  “{r.message}”
                </p>
              )}

              <p className="mt-2 text-xs text-base-content/50">
                {new Date(r.created_at).toLocaleString("lt-LT")}
                {r.path && ` · ${r.path}`}
                {r.is_guest === true && " · svečias"}
                {r.is_guest === false && " · prisijungęs"}
              </p>

              {r.contact_email && (
                <p className="mt-1 text-sm">
                  <a
                    className="link link-hover font-medium"
                    href={`mailto:${r.contact_email}`}
                  >
                    {r.contact_email}
                  </a>
                </p>
              )}

              {r.detail && Object.keys(r.detail).length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-base-content/50">
                    Detalės
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-base-200 p-2 text-xs">
                    {JSON.stringify(r.detail, null, 2)}
                  </pre>
                  {r.user_agent && (
                    <p className="mt-1 break-all text-xs text-base-content/40">
                      {r.user_agent}
                    </p>
                  )}
                </details>
              )}
            </div>

            {!r.handled_at && (
              <button
                type="button"
                className="btn btn-sm btn-outline shrink-0"
                onClick={() => handle(r.id)}
                disabled={busyId === r.id}
                data-busy={busyId === r.id || undefined}
              >
                <LuCheck size={14} />
                Peržiūrėta
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
