"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuPlus, LuTriangleAlert, LuClock, LuPencil } from "react-icons/lu";
import toast from "react-hot-toast";
import { createEditorialShelf } from "../actions";
import {
  MIN_ITEMS,
  type EditorialShelf,
  type ShelfHealth,
  type ScheduleState,
} from "../_lib/types";
import { fmtDate, fromLocalInput } from "../_lib/dates";

export type ShelfRow = EditorialShelf & {
  health: ShelfHealth;
  schedule: ScheduleState;
};

const SCHEDULE_LABEL: Record<ScheduleState, string> = {
  live: "Rodoma",
  scheduled: "Suplanuota",
  ended: "Pasibaigusi",
  inactive: "Išjungta",
};

const SCHEDULE_BADGE: Record<ScheduleState, string> = {
  live: "badge-success",
  scheduled: "badge-info",
  ended: "badge-ghost",
  inactive: "badge-ghost",
};

export function EditorialListClient({ shelves }: { shelves: ShelfRow[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const createRef = useRef<HTMLDialogElement>(null);

  const [labelLt, setLabelLt] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [slug, setSlug] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [sortOrder, setSortOrder] = useState("100");

  function handleCreate() {
    startTransition(async () => {
      const res = await createEditorialShelf({
        labelLt,
        labelEn,
        slug: slug || undefined,
        startsAt: fromLocalInput(startsAt),
        endsAt: fromLocalInput(endsAt),
        sortOrder: Number(sortOrder) || 100,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Lentyna sukurta — dabar pridėkite produktų.");
      setLabelLt("");
      setLabelEn("");
      setSlug("");
      setStartsAt("");
      setEndsAt("");
      createRef.current?.close();
      // Straight into the pick editor: an empty shelf is not useful yet.
      router.push(`/admin/editorial/${res.id}`);
    });
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            Redakcijos lentynos{" "}
            <span className="text-lg font-normal text-base-content/40">
              ({shelves.length})
            </span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-base-content/60">
            Rankomis atrinktos lentynos Discover puslapyje. Savaitinis LLM
            kuratorius jų neliečia, o rodymo laikotarpį nustatote čia — be
            diegimo.
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm gap-1"
          onClick={() => createRef.current?.showModal()}
          disabled={pending}
        >
          <LuPlus size={15} /> Nauja lentyna
        </button>
      </div>

      <div className="card mt-6 bg-base-100 card-border">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Lentyna</th>
                  <th>Būsena</th>
                  <th>Rodoma nuo / iki</th>
                  <th className="text-right">Produktai</th>
                  <th className="text-right">Eilė</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shelves.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-base-content/40">
                      Kol kas nėra redakcijos lentynų.
                    </td>
                  </tr>
                ) : (
                  shelves.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link
                          href={`/admin/editorial/${s.id}`}
                          className="font-medium hover:underline"
                        >
                          {s.label_lt}
                        </Link>
                        <div className="text-xs text-base-content/50">
                          {s.slug}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge badge-sm ${SCHEDULE_BADGE[s.schedule]}`}
                        >
                          {SCHEDULE_LABEL[s.schedule]}
                        </span>
                      </td>
                      <td className="text-xs text-base-content/60">
                        <div className="flex items-center gap-1">
                          <LuClock size={11} className="shrink-0" />
                          {fmtDate(s.starts_at)} → {fmtDate(s.ends_at)}
                        </div>
                      </td>
                      <td className="text-right">
                        <span className="tabular-nums">{s.health.live}</span>
                        <span className="text-base-content/40">
                          {" "}
                          / {s.health.total}
                        </span>
                        {/* The three silent failures, named on the list so a
                            broken shelf does not need opening to be spotted. */}
                        {!s.health.meetsMinimum && (
                          <div className="flex items-center justify-end gap-1 text-xs text-error">
                            <LuTriangleAlert size={11} />
                            nerodoma (&lt;{MIN_ITEMS})
                          </div>
                        )}
                        {s.health.dropped > 0 && (
                          <div className="text-xs text-warning">
                            {s.health.dropped} dingo iš srauto
                          </div>
                        )}
                        {s.health.outOfStock > 0 && (
                          <div className="text-xs text-base-content/50">
                            {s.health.outOfStock} neturima
                          </div>
                        )}
                      </td>
                      <td className="text-right tabular-nums text-base-content/60">
                        {s.sort_order}
                      </td>
                      <td>
                        <div className="flex justify-end">
                          <Link
                            href={`/admin/editorial/${s.id}`}
                            className="btn btn-ghost btn-xs gap-1"
                          >
                            <LuPencil size={13} /> Redaguoti
                          </Link>
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

      <dialog ref={createRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="font-heading text-lg font-bold">Nauja lentyna</h3>
          <p className="mt-1 text-sm text-base-content/60">
            Palikus datas tuščias, lentyna rodoma iš karto ir neribotai.
          </p>

          <label className="form-control mt-4 w-full">
            <span className="label-text text-sm">Pavadinimas (LT)</span>
            <input
              className="input input-bordered w-full"
              value={labelLt}
              onChange={(e) => setLabelLt(e.target.value)}
              placeholder="pvz. Motinos dienai"
            />
          </label>

          <label className="form-control mt-3 w-full">
            <span className="label-text text-sm">
              Pavadinimas (EN){" "}
              <span className="text-base-content/40">— nebūtina</span>
            </span>
            <input
              className="input input-bordered w-full"
              value={labelEn}
              onChange={(e) => setLabelEn(e.target.value)}
              placeholder="For Mother's Day"
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

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="form-control w-full">
              <span className="label-text text-sm">Rodyti nuo</span>
              <input
                type="datetime-local"
                className="input input-bordered w-full"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text text-sm">Rodyti iki</span>
              <input
                type="datetime-local"
                className="input input-bordered w-full"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </label>
          </div>

          <label className="form-control mt-3 w-full">
            <span className="label-text text-sm">
              Eiliškumas{" "}
              <span className="text-base-content/40">
                — mažesnis rodomas aukščiau
              </span>
            </span>
            <input
              type="number"
              className="input input-bordered w-full"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
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
              disabled={pending || labelLt.trim().length < 2}
            >
              Sukurti
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
