"use client";

import { useRef, useState, useTransition } from "react";
import {
  LuPlus,
  LuUserPlus,
  LuLogOut,
  LuCopy,
  LuTrash2,
  LuMailPlus,
  LuStore,
  LuTriangleAlert,
  LuClock,
} from "react-icons/lu";
import toast from "react-hot-toast";
import {
  createPartner,
  joinPartnerAsStaff,
  leavePartnerAsStaff,
  invitePartnerUser,
  revokePartnerInvite,
  setPartnerActive,
  setPartnerFeedAutoApprove,
} from "../actions";

export type AdminInvite = {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
};

export type AdminPartnerRow = {
  id: string;
  name: string;
  slug: string | null;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
  productCount: number;
  memberCount: number;
  /** Is the signed-in admin currently a member of this partner? */
  isStaff: boolean;
  storeDomain: string | null;
  feedPlatform: string | null;
  feedAutoApprove: boolean;
  feedLastSyncedAt: string | null;
  feedLastStatus: string | null;
  feedLastError: string | null;
  feedLastCount: number | null;
  invites: AdminInvite[];
};

export function PartnersClient({ partners }: { partners: AdminPartnerRow[] }) {
  const [pending, startTransition] = useTransition();
  const createRef = useRef<HTMLDialogElement>(null);
  const inviteRef = useRef<HTMLDialogElement>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [website, setWebsite] = useState("");

  const [inviteFor, setInviteFor] = useState<AdminPartnerRow | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");

  function copyInvite(token: string) {
    navigator.clipboard.writeText(
      `${window.location.origin}/partner/join/${token}`
    );
    toast.success("Kvietimo nuoroda nukopijuota.");
  }

  function handleCreate() {
    startTransition(async () => {
      const res = await createPartner({
        name,
        slug: slug || undefined,
        websiteUrl: website || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Partneris „${res.partner.name}" sukurtas.`);
      setName("");
      setSlug("");
      setWebsite("");
      createRef.current?.close();
    });
  }

  function handleJoin(p: AdminPartnerRow) {
    startTransition(async () => {
      const res = await joinPartnerAsStaff(p.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Prisijungta — dabar matote partnerio skydelį.");
    });
  }

  function handleLeave(p: AdminPartnerRow) {
    startTransition(async () => {
      const res = await leavePartnerAsStaff(p.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Atsijungta nuo partnerio.");
    });
  }

  function handleInvite() {
    if (!inviteFor) return;
    startTransition(async () => {
      const res = await invitePartnerUser(inviteFor.id, inviteEmail, "owner");
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      navigator.clipboard.writeText(
        `${window.location.origin}/partner/join/${res.token}`
      );
      toast.success("Kvietimas sukurtas — nuoroda nukopijuota.");
      setInviteEmail("");
      inviteRef.current?.close();
    });
  }

  function handleRevoke(inviteId: string) {
    startTransition(async () => {
      const res = await revokePartnerInvite(inviteId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Kvietimas atšauktas.");
    });
  }

  function handleToggleAutoApprove(p: AdminPartnerRow) {
    startTransition(async () => {
      const res = await setPartnerFeedAutoApprove(p.id, !p.feedAutoApprove);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        p.feedAutoApprove
          ? "Srauto produktai vėl bus moderuojami."
          : "Srauto produktai bus tvirtinami automatiškai."
      );
    });
  }

  function handleToggleActive(p: AdminPartnerRow) {
    startTransition(async () => {
      const res = await setPartnerActive(p.id, !p.is_active);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(p.is_active ? "Partneris išjungtas." : "Partneris įjungtas.");
    });
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            Partneriai{" "}
            <span className="text-lg font-normal text-base-content/40">
              ({partners.length})
            </span>
          </h1>
          <p className="mt-1 text-sm text-base-content/60">
            Partnerių portalo paskyros. Paskyrą sukuria Noriuto komanda, vėliau
            ji perduodama partneriui kvietimu.
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm gap-1"
          onClick={() => createRef.current?.showModal()}
          disabled={pending}
        >
          <LuPlus size={15} /> Naujas partneris
        </button>
      </div>

      <div className="card mt-6 bg-base-100 card-border">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Partneris</th>
                  <th>Būsena</th>
                  <th className="text-right">Produktai</th>
                  <th className="text-right">Nariai</th>
                  <th>Sukurta</th>
                  <th className="text-right">Veiksmai</th>
                </tr>
              </thead>
              <tbody>
                {partners.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-base-content/40">
                      Kol kas nėra partnerių.
                    </td>
                  </tr>
                ) : (
                  partners.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.name}</span>
                          {p.isStaff && (
                            <span className="badge badge-info badge-xs">
                              esate narys
                            </span>
                          )}
                        </div>
                        {p.website_url && (
                          <a
                            href={p.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-base-content/50 hover:underline"
                          >
                            {p.website_url.replace(/^https?:\/\//, "")}
                          </a>
                        )}
                        {p.storeDomain && (
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <span className="flex items-center gap-1 text-base-content/50">
                              <LuStore size={11} /> {p.storeDomain}
                            </span>
                            {p.feedPlatform && (
                              <span className="badge badge-ghost badge-xs">
                                {p.feedPlatform}
                              </span>
                            )}
                            <button
                              className={`badge badge-xs ${
                                p.feedAutoApprove ? "badge-success" : "badge-ghost"
                              }`}
                              onClick={() => handleToggleAutoApprove(p)}
                              disabled={pending}
                              title="Automatiškai tvirtinti šio srauto produktus"
                            >
                              {p.feedAutoApprove
                                ? "auto-tvirtinama"
                                : "moderuojama"}
                            </button>
                          </div>
                        )}
                        {p.storeDomain && (
                          <div className="mt-1 text-xs">
                            {p.feedLastStatus === "error" ? (
                              <div className="flex items-start gap-1 text-error">
                                <LuTriangleAlert
                                  size={12}
                                  className="mt-0.5 shrink-0"
                                />
                                <span>
                                  Sinchronizavimas nepavyko
                                  {p.feedLastSyncedAt &&
                                    ` (${new Date(
                                      p.feedLastSyncedAt
                                    ).toLocaleString("lt-LT")})`}
                                  : {p.feedLastError}
                                </span>
                              </div>
                            ) : p.feedLastSyncedAt ? (
                              <span className="flex items-center gap-1 text-base-content/50">
                                <LuClock size={11} />
                                {new Date(p.feedLastSyncedAt).toLocaleString(
                                  "lt-LT"
                                )}
                                {p.feedLastCount != null &&
                                  ` · ${p.feedLastCount} vnt.`}
                              </span>
                            ) : (
                              <span className="text-warning">
                                Dar nesinchronizuota
                              </span>
                            )}
                          </div>
                        )}
                        {p.invites.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {p.invites.map((inv) => (
                              <div
                                key={inv.id}
                                className="flex items-center gap-2 text-xs text-base-content/60"
                              >
                                <span className="badge badge-ghost badge-xs">
                                  kvietimas
                                </span>
                                <span>{inv.email}</span>
                                <span className="opacity-60">({inv.role})</span>
                                <button
                                  className="btn btn-ghost btn-xs gap-1"
                                  onClick={() => copyInvite(inv.token)}
                                >
                                  <LuCopy size={11} /> Kopijuoti
                                </button>
                                <button
                                  className="btn btn-ghost btn-xs text-error"
                                  onClick={() => handleRevoke(inv.id)}
                                  disabled={pending}
                                >
                                  <LuTrash2 size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          className={`badge badge-sm ${
                            p.is_active ? "badge-success" : "badge-ghost"
                          }`}
                          onClick={() => handleToggleActive(p)}
                          disabled={pending}
                          title="Perjungti būseną"
                        >
                          {p.is_active ? "Aktyvus" : "Neaktyvus"}
                        </button>
                      </td>
                      <td className="text-right tabular-nums">
                        {p.productCount}
                      </td>
                      <td className="text-right tabular-nums">
                        {p.memberCount}
                      </td>
                      <td className="text-sm text-base-content/60">
                        {new Date(p.created_at).toLocaleDateString("lt-LT")}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          {p.isStaff ? (
                            <button
                              className="btn btn-ghost btn-xs gap-1"
                              onClick={() => handleLeave(p)}
                              disabled={pending}
                              title="Pašalinti savo narystę (perdavimas)"
                            >
                              <LuLogOut size={13} /> Atsijungti
                            </button>
                          ) : (
                            <button
                              className="btn btn-ghost btn-xs gap-1"
                              onClick={() => handleJoin(p)}
                              disabled={pending}
                              title="Prisijungti, kad galėtumėte paruošti paskyrą"
                            >
                              <LuUserPlus size={13} /> Prisijungti
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-xs gap-1"
                            onClick={() => {
                              setInviteFor(p);
                              inviteRef.current?.showModal();
                            }}
                            disabled={pending}
                          >
                            <LuMailPlus size={13} /> Kviesti
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create partner */}
      <dialog ref={createRef} className="modal">
        <div className="modal-box max-w-md">
          <h3 className="font-heading text-lg font-bold">Naujas partneris</h3>
          <p className="mt-1 text-sm text-base-content/60">
            Sukūrę paskyrą, prisijunkite prie jos kaip narys, paruoškite
            produktus, o tada perduokite partneriui kvietimu.
          </p>

          <label className="form-control mt-4 w-full">
            <span className="label-text text-sm">Pavadinimas</span>
            <input
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="pvz. Red Tuxedo Ceramics"
            />
          </label>

          <label className="form-control mt-3 w-full">
            <span className="label-text text-sm">
              Nuoroda (slug){" "}
              <span className="text-base-content/40">— nebūtina</span>
            </span>
            <input
              className="input input-bordered w-full"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="sugeneruojama iš pavadinimo"
            />
          </label>

          <label className="form-control mt-3 w-full">
            <span className="label-text text-sm">
              Svetainė <span className="text-base-content/40">— nebūtina</span>
            </span>
            <input
              className="input input-bordered w-full"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="redtuxedoceramics.com"
            />
          </label>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => createRef.current?.close()}
            >
              Atšaukti
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleCreate}
              disabled={pending || name.trim().length < 2}
            >
              Sukurti
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* Invite owner */}
      <dialog ref={inviteRef} className="modal">
        <div className="modal-box max-w-md">
          <h3 className="font-heading text-lg font-bold">
            Kviesti savininką{inviteFor ? ` — ${inviteFor.name}` : ""}
          </h3>
          <p className="mt-1 text-sm text-base-content/60">
            Kvietimą galės priimti tik šis el. paštas. Nuoroda galioja 7 dienas
            ir bus nukopijuota į iškarpinę — nusiųskite ją patys.
          </p>

          <label className="form-control mt-4 w-full">
            <span className="label-text text-sm">Partnerio el. paštas</span>
            <input
              className="input input-bordered w-full"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="vardas@parduotuve.lt"
            />
          </label>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => inviteRef.current?.close()}
            >
              Atšaukti
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleInvite}
              disabled={pending || !inviteEmail.trim()}
            >
              Sukurti kvietimą
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}
