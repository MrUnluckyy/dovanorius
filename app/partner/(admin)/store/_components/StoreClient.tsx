"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { LuRefreshCw, LuSave, LuCircleCheck, LuCircleAlert } from "react-icons/lu";
import { saveStoreDomain, syncNow } from "../actions";

export type StoreState = {
  domain: string | null;
  /** Detected when the domain was saved, not chosen by the partner. */
  platform: string | null;
  platformLabel: string | null;
  autoApprove: boolean;
  lastSyncedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastCount: number | null;
  syncedProductCount: number;
};

export function StoreClient({ state }: { state: StoreState }) {
  const [pending, startTransition] = useTransition();
  const [domain, setDomain] = useState(state.domain ?? "");

  function handleSave() {
    startTransition(async () => {
      const res = await saveStoreDomain(domain);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.domain
          ? `Parduotuvė prijungta: ${res.domain}${
              res.platformLabel ? ` (${res.platformLabel})` : ""
            }`
          : "Parduotuvė atjungta."
      );
    });
  }

  function handleSync() {
    startTransition(async () => {
      const res = await syncNow();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const r = res.result;
      toast.success(
        `Rasta ${r.fetched} · importuota ${r.written} · praleista išparduotų ${r.skippedSoldOut} · išjungta ${r.deactivated}`
      );
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Parduotuvė</h1>
        <p className="mt-1 text-sm text-base-content/60">
          Prijunkite savo internetinę parduotuvę — produktai bus atnaujinami
          kasdien: kainos, nuotraukos ir prekių likutis. Palaikomos Shopify ir
          WooCommerce parduotuvės.
        </p>
      </div>

      <div className="card bg-base-100 card-border">
        <div className="card-body">
          <label className="form-control w-full">
            <span className="label-text text-sm">Parduotuvės adresas</span>
            <div className="flex gap-2">
              <input
                className="input input-bordered flex-1"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="pvz. redtuxedoceramics.com"
                disabled={pending}
              />
              <button
                className="btn btn-primary gap-1"
                onClick={handleSave}
                disabled={pending}
              >
                <LuSave size={15} /> Išsaugoti
              </button>
            </div>
            <span className="label-text-alt mt-1 text-base-content/50">
              Įveskite tik domeną — platformą atpažinsime patys. Naudojame viešą
              produktų sąrašą, slaptažodžių ar API raktų nereikia.
            </span>
          </label>

          {state.domain && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-base-300 pt-4">
              {state.platformLabel && (
                <span className="badge badge-ghost badge-sm">
                  {state.platformLabel}
                </span>
              )}
              <button
                className="btn btn-outline btn-sm gap-1"
                onClick={handleSync}
                disabled={pending}
              >
                <LuRefreshCw size={14} className={pending ? "animate-spin" : ""} />
                Atnaujinti dabar
              </button>

              <span className="text-sm text-base-content/60">
                Susietų produktų: <b>{state.syncedProductCount}</b>
              </span>

              {state.lastSyncedAt && (
                <span className="flex items-center gap-1 text-sm text-base-content/60">
                  {state.lastStatus === "ok" ? (
                    <LuCircleCheck size={14} className="text-success" />
                  ) : (
                    <LuCircleAlert size={14} className="text-error" />
                  )}
                  {new Date(state.lastSyncedAt).toLocaleString("lt-LT")}
                  {state.lastCount != null && ` · ${state.lastCount} vnt.`}
                </span>
              )}
            </div>
          )}

          {state.lastStatus === "error" && state.lastError && (
            <div className="alert alert-error mt-3 text-sm">
              {state.lastError}
            </div>
          )}
        </div>
      </div>

      <div
        className={`alert text-sm ${
          state.autoApprove ? "alert-success" : "alert-info"
        }`}
      >
        {state.autoApprove
          ? "Jūsų parduotuvė patvirtinta — nauji produktai rodomi iš karto."
          : "Nauji produktai laukia Noriuto komandos patvirtinimo prieš pasirodant sraute."}
      </div>
    </div>
  );
}
