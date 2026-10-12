"use client";

import { useRef, useState, useTransition } from "react";
import { LuCopy, LuPlug } from "react-icons/lu";
import toast from "react-hot-toast";
import { setShopifyWebhookSecret } from "../actions";

export type TrackingRow = {
  id: string;
  name: string;
  platform: string | null;
  storeDomain: string | null;
  hasSecret: boolean;
  lastDeliveryAt: string | null;
  clicks: number;
  orders: number;
  sales: number;
};

// The apex 307s to www, and Shopify does not follow redirects on webhooks.
const SITE = "https://www.noriuto.lt";

const eur = (n: number) =>
  new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR" }).format(n);

function webhookUrl(partnerId: string) {
  return `${SITE}/api/webhooks/shopify/${partnerId}`;
}

/** What to send the shop owner, ready to paste into an email. */
function instructions(partnerId: string) {
  return `Sveiki!

Kad matytumėte, kiek užsakymų jums atneša Noriuto, prašome sukurti du webhook'us savo Shopify parduotuvėje (užtruks ~5 min.):

1. Shopify administravime atidarykite Settings → Notifications → Webhooks.
2. Spauskite „Create webhook“:
   • Event: Order creation
   • Format: JSON
   • URL: ${webhookUrl(partnerId)}
   • Webhook API version: naujausia (Latest)
   Išsaugokite.
3. Pakartokite tą patį su Event: Order cancellation (tas pats URL).
4. Po webhook'ų sąrašu Shopify parodo raktą („Your webhooks will be signed with …“). Nukopijuokite jį ir atsiųskite mums atsakydami į šį laišką.

Mes gauname tik užsakymus, atėjusius per Noriuto nuorodas (jų numerį, sumą ir datą). Pirkėjų vardų, el. pašto ar adresų nesaugome.

Ačiū!`;
}

export function OrdersTrackingClient({ rows }: { rows: TrackingRow[] }) {
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<TrackingRow | null>(null);
  const [secret, setSecret] = useState("");

  function open(row: TrackingRow) {
    setActive(row);
    setSecret("");
    dialogRef.current?.showModal();
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} nukopijuota.`);
    } catch {
      toast.error("Nepavyko nukopijuoti — pažymėkite ir kopijuokite ranka.");
    }
  }

  function save(value: string) {
    if (!active) return;
    startTransition(async () => {
      const res = await setShopifyWebhookSecret(active.id, value);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(value.trim() ? "Raktas išsaugotas." : "Sekimas išjungtas.");
      dialogRef.current?.close();
    });
  }

  return (
    <>
      <div className="card bg-base-100 card-border">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Partneris</th>
                  <th>Užsakymų sekimas</th>
                  <th className="text-right">Paspaudimai</th>
                  <th className="text-right">Užsakymai</th>
                  <th className="text-right">Pardavimai</th>
                  <th className="text-right">Konversija</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="font-medium">{r.name}</div>
                      {r.storeDomain && (
                        <div className="text-xs text-base-content/50">{r.storeDomain}</div>
                      )}
                    </td>
                    <td className="text-xs">
                      <Status row={r} />
                    </td>
                    <td className="text-right tabular-nums">{r.clicks}</td>
                    <td className="text-right tabular-nums">{r.orders}</td>
                    <td className="text-right tabular-nums">{eur(r.sales)}</td>
                    <td className="text-right tabular-nums">
                      {r.clicks > 0 ? `${((100 * r.orders) / r.clicks).toFixed(1)}%` : "—"}
                    </td>
                    <td className="text-right">
                      {r.platform === "shopify" ? (
                        <button
                          className="btn btn-ghost btn-xs gap-1"
                          onClick={() => open(r)}
                          disabled={pending}
                        >
                          <LuPlug size={12} /> {r.hasSecret ? "Nustatymai" : "Prijungti"}
                        </button>
                      ) : (
                        <span
                          className="text-xs text-base-content/40"
                          title="Užsakymų sekimas kol kas tik Shopify parduotuvėms"
                        >
                          {r.platform ?? "be srauto"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-2xl">
          <h3 className="font-heading text-lg font-bold">
            Shopify užsakymų sekimas{active ? ` — ${active.name}` : ""}
          </h3>
          {active && (
            <>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-base-content/70">
                <li>Nusiųskite partneriui instrukciją žemiau.</li>
                <li>Kai jis atsiųs raktą, įklijuokite jį čia ir išsaugokite.</li>
                <li>
                  Paprašykite paspausti „Send test notification“ prie webhook&apos;o.
                  Sėkmingai gavus, stulpelyje atsiras „Prijungta“.
                </li>
              </ol>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold">Webhook adresas</span>
                  <button
                    className="btn btn-ghost btn-xs gap-1"
                    onClick={() => copy(webhookUrl(active.id), "Adresas")}
                  >
                    <LuCopy size={12} /> Kopijuoti
                  </button>
                </div>
                <code className="block break-all rounded bg-base-200 px-3 py-2 text-xs">
                  {webhookUrl(active.id)}
                </code>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold">Instrukcija partneriui</span>
                  <button
                    className="btn btn-ghost btn-xs gap-1"
                    onClick={() => copy(instructions(active.id), "Instrukcija")}
                  >
                    <LuCopy size={12} /> Kopijuoti
                  </button>
                </div>
                <textarea
                  className="textarea textarea-bordered h-48 w-full text-xs"
                  readOnly
                  value={instructions(active.id)}
                />
              </div>

              <label className="form-control mt-4 w-full">
                <span className="label-text text-sm font-semibold">
                  Shopify parašo raktas
                </span>
                <input
                  className="input input-bordered w-full font-mono text-sm"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={active.hasSecret ? "Raktas jau išsaugotas — įklijuokite naują, kad pakeistumėte" : "Įklijuokite raktą iš partnerio"}
                  autoComplete="off"
                />
              </label>

              <div className="modal-action">
                {active.hasSecret && (
                  <button
                    className="btn btn-ghost btn-sm mr-auto text-error"
                    onClick={() => save("")}
                    disabled={pending}
                  >
                    Išjungti sekimą
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => dialogRef.current?.close()}
                >
                  Uždaryti
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => save(secret)}
                  disabled={pending || !secret.trim()}
                >
                  Išsaugoti raktą
                </button>
              </div>
            </>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}

function Status({ row }: { row: TrackingRow }) {
  if (!row.hasSecret) return <span className="text-base-content/40">Neprijungta</span>;
  if (!row.lastDeliveryAt)
    return <span className="badge badge-warning badge-sm">Laukiama pirmo pranešimo</span>;
  return (
    <span className="badge badge-success badge-sm" title="Paskutinis pranešimas iš Shopify">
      Prijungta · {new Date(row.lastDeliveryAt).toLocaleDateString("lt-LT")}
    </span>
  );
}
