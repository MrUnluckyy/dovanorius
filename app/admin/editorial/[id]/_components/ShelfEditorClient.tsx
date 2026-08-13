"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LuArrowLeft,
  LuPlus,
  LuTrash2,
  LuChevronUp,
  LuChevronDown,
  LuTriangleAlert,
  LuRefreshCw,
  LuSearch,
  LuCircleOff,
  LuPackageX,
} from "react-icons/lu";
import toast from "react-hot-toast";
import {
  updateEditorialShelf,
  setEditorialShelfActive,
  deleteEditorialShelf,
  searchProducts,
  addPick,
  removePick,
  updatePickReason,
  reorderPicks,
  resyncShelf,
  type ProductHit,
} from "../../actions";
import {
  MIN_ITEMS,
  type EditorialPick,
  type EditorialShelf,
  type ShelfHealth,
  type ScheduleState,
} from "../../_lib/types";
import { fmtDate, toLocalInput, fromLocalInput } from "../../_lib/dates";

export function ShelfEditorClient({
  shelf,
  picks,
  health,
  schedule,
}: {
  shelf: EditorialShelf;
  picks: EditorialPick[];
  health: ShelfHealth;
  schedule: ScheduleState;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const deleteRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLDialogElement>(null);

  const [labelLt, setLabelLt] = useState(shelf.label_lt);
  const [labelEn, setLabelEn] = useState(shelf.label_en);
  const [description, setDescription] = useState(shelf.description);
  const [startsAt, setStartsAt] = useState(toLocalInput(shelf.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(shelf.ends_at));
  const [sortOrder, setSortOrder] = useState(String(shelf.sort_order));

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [searching, setSearching] = useState(false);

  const pickedIds = new Set(picks.map((p) => p.product_id));

  function handleSave() {
    startTransition(async () => {
      const res = await updateEditorialShelf(shelf.id, {
        labelLt,
        labelEn,
        description,
        startsAt: fromLocalInput(startsAt),
        endsAt: fromLocalInput(endsAt),
        sortOrder: Number(sortOrder) || 100,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Išsaugota.");
      router.refresh();
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      const res = await setEditorialShelfActive(shelf.id, !shelf.is_active);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(shelf.is_active ? "Lentyna išjungta." : "Lentyna įjungta.");
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteEditorialShelf(shelf.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      deleteRef.current?.close();
      toast.success("Lentyna ištrinta.");
      router.push("/admin/editorial");
    });
  }

  async function runSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    const res = await searchProducts(query);
    setSearching(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setHits(res.hits);
    if (!res.hits.length) toast("Nieko nerasta.", { icon: "🔍" });
  }

  function handleAdd(productId: string) {
    startTransition(async () => {
      const res = await addPick(shelf.id, productId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Pridėta.");
      router.refresh();
    });
  }

  function handleRemove(productId: string) {
    startTransition(async () => {
      const res = await removePick(shelf.id, productId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Pašalinta.");
      router.refresh();
    });
  }

  function handleReason(productId: string, reason: string) {
    startTransition(async () => {
      const res = await updatePickReason(shelf.id, productId, reason);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  /** Move a pick one slot and send the whole resulting order. */
  function handleMove(index: number, delta: number) {
    const next = [...picks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];

    startTransition(async () => {
      const res = await reorderPicks(
        shelf.id,
        next.map((p) => p.product_id)
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleResync() {
    startTransition(async () => {
      const res = await resyncShelf(shelf.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Sinchronizuota su katalogu.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/editorial"
          className="flex items-center gap-1 text-sm text-base-content/60 hover:underline"
        >
          <LuArrowLeft size={14} /> Visos lentynos
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold">{shelf.label_lt}</h1>
            <p className="text-sm text-base-content/50">{shelf.slug}</p>
          </div>
          <div className="flex gap-2">
            <button
              className={`btn btn-sm ${shelf.is_active ? "btn-ghost" : "btn-primary"}`}
              onClick={handleToggleActive}
              disabled={pending}
            >
              {shelf.is_active ? "Išjungti" : "Įjungti"}
            </button>
            <button
              className="btn btn-ghost btn-sm text-error"
              onClick={() => deleteRef.current?.showModal()}
              disabled={pending}
            >
              <LuTrash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Readiness. Every way this shelf can be invisible, stated outright. */}
      <div className="card bg-base-100 card-border">
        <div className="card-body gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <Stat label="Atrinkta" value={health.total} />
            <Stat label="Rodoma" value={health.live} tone="success" />
            <Stat label="Neturima" value={health.outOfStock} tone="muted" />
            <Stat label="Dingo iš srauto" value={health.dropped} tone="warning" />
            <button
              className="btn btn-ghost btn-xs ml-auto gap-1"
              onClick={handleResync}
              disabled={pending}
              title="Perkurti rodomą sąrašą iš atrinktų produktų"
            >
              <LuRefreshCw size={13} /> Sinchronizuoti
            </button>
          </div>

          {!health.meetsMinimum && (
            <div className="alert alert-error py-2 text-sm">
              <LuTriangleAlert size={16} />
              <span>
                Nerodoma Discover puslapyje — reikia bent {MIN_ITEMS} turimų
                produktų, dabar yra {health.live}.
              </span>
            </div>
          )}

          {schedule !== "live" && (
            <div className="alert alert-info py-2 text-sm">
              <LuCircleOff size={16} />
              <span>
                {schedule === "inactive" &&
                  "Lentyna išjungta — nerodoma nepriklausomai nuo datų."}
                {schedule === "scheduled" &&
                  `Dar nerodoma. Pasirodys ${fmtDate(shelf.starts_at)}.`}
                {schedule === "ended" &&
                  `Rodymas baigėsi ${fmtDate(shelf.ends_at)}.`}
              </span>
            </div>
          )}

          {health.dropped > 0 && (
            <div className="alert alert-warning py-2 text-sm">
              <LuPackageX size={16} />
              <span>
                {health.dropped} produkt(ai) dingo iš tiekėjo srauto ir nebėra
                kataloge. Jie pažymėti sąraše — pakeiskite juos kitais.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="card bg-base-100 card-border">
        <div className="card-body">
          <h2 className="font-heading text-lg font-bold">Nustatymai</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="form-control w-full">
              <span className="label-text text-sm">Pavadinimas (LT)</span>
              <input
                className="input input-bordered w-full"
                value={labelLt}
                onChange={(e) => setLabelLt(e.target.value)}
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text text-sm">Pavadinimas (EN)</span>
              <input
                className="input input-bordered w-full"
                value={labelEn}
                onChange={(e) => setLabelEn(e.target.value)}
              />
            </label>
          </div>

          <label className="form-control mt-1 w-full">
            <span className="label-text text-sm">
              Vidinis aprašymas{" "}
              <span className="text-base-content/40">— nerodomas viešai</span>
            </span>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="mt-1 grid gap-3 sm:grid-cols-3">
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
            <label className="form-control w-full">
              <span className="label-text text-sm">Eiliškumas</span>
              <input
                type="number"
                className="input input-bordered w-full"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </label>
          </div>

          <p className="mt-1 text-xs text-base-content/50">
            Naršyklės talpykla atnaujinama iki valandos, todėl lentyna gali
            pasirodyti šiek tiek vėliau nei nurodytas laikas.
          </p>

          <div className="mt-2 flex justify-end">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={pending || labelLt.trim().length < 2}
            >
              Išsaugoti
            </button>
          </div>
        </div>
      </div>

      {/* Picks */}
      <div className="card bg-base-100 card-border">
        <div className="card-body">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-bold">
              Produktai{" "}
              <span className="text-base font-normal text-base-content/40">
                ({picks.length})
              </span>
            </h2>
            <button
              className="btn btn-primary btn-sm gap-1"
              onClick={() => searchRef.current?.showModal()}
              disabled={pending}
            >
              <LuPlus size={15} /> Pridėti produktą
            </button>
          </div>

          <p className="text-sm text-base-content/60">
            Eiliškumas čia yra eiliškumas Discover puslapyje — rankomis
            sudėliotos lentynos nesukamos kasdien.
          </p>

          {picks.length === 0 ? (
            <div className="py-8 text-center text-sm text-base-content/40">
              Kol kas nieko neatrinkta.
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-base-300">
              {picks.map((p, i) => (
                <PickRow
                  key={p.product_id}
                  pick={p}
                  index={i}
                  last={i === picks.length - 1}
                  pending={pending}
                  onMove={handleMove}
                  onRemove={handleRemove}
                  onReason={handleReason}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      <dialog ref={deleteRef} className="modal">
        <div className="modal-box max-w-md">
          <h3 className="font-heading text-lg font-bold">Ištrinti lentyną?</h3>
          <p className="mt-2 text-sm text-base-content/70">
            „{shelf.label_lt}&ldquo; ir visi {picks.length} atrinkti produktai
            bus ištrinti negrįžtamai.
          </p>
          <div className="modal-action">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => deleteRef.current?.close()}
            >
              Atšaukti
            </button>
            <button
              className="btn btn-error btn-sm"
              onClick={handleDelete}
              disabled={pending}
            >
              Ištrinti
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* Product search */}
      <dialog ref={searchRef} className="modal">
        <div className="modal-box max-w-3xl">
          <h3 className="font-heading text-lg font-bold">Pridėti produktą</h3>

          <div className="mt-3 flex gap-2">
            <input
              className="input input-bordered flex-1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch();
                }
              }}
              placeholder="Ieškoti pagal pavadinimą…"
            />
            <button
              className="btn btn-primary gap-1"
              onClick={runSearch}
              disabled={searching || query.trim().length < 2}
            >
              <LuSearch size={15} /> Ieškoti
            </button>
          </div>

          <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
            {searching && (
              <div className="py-6 text-center text-sm text-base-content/50">
                Ieškoma…
              </div>
            )}
            {!searching &&
              hits.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-3 rounded-lg border border-base-300 p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={h.image_url ?? ""}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {h.product_name}
                    </div>
                    <div className="text-xs text-base-content/50">
                      {[h.brand_name, h.merchant_name].filter(Boolean).join(" · ")}
                      {h.price != null && ` · ${h.price} €`}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleAdd(h.id)}
                    disabled={pending || pickedIds.has(h.id)}
                  >
                    {pickedIds.has(h.id) ? "Jau atrinkta" : "Pridėti"}
                  </button>
                </div>
              ))}
          </div>

          <div className="modal-action">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => searchRef.current?.close()}
            >
              Uždaryti
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "muted";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? value > 0
          ? "text-warning"
          : "text-base-content/40"
        : tone === "muted"
          ? "text-base-content/40"
          : "";
  return (
    <div>
      <div className={`font-heading text-xl font-bold tabular-nums ${color}`}>
        {value}
      </div>
      <div className="text-xs text-base-content/50">{label}</div>
    </div>
  );
}

function PickRow({
  pick,
  index,
  last,
  pending,
  onMove,
  onRemove,
  onReason,
}: {
  pick: EditorialPick;
  index: number;
  last: boolean;
  pending: boolean;
  onMove: (index: number, delta: number) => void;
  onRemove: (productId: string) => void;
  onReason: (productId: string, reason: string) => void;
}) {
  const [reason, setReason] = useState(pick.reason ?? "");
  const dropped = pick.state === "dropped";

  // Falls back to the snapshot once the product is gone from the catalogue —
  // that is the whole reason the snapshot is stored.
  const name = pick.product_name ?? pick.name_snapshot ?? pick.product_id;
  const image = pick.image_url ?? pick.image_snapshot;

  return (
    <li className={`flex gap-3 py-3 ${dropped ? "opacity-70" : ""}`}>
      <div className="flex flex-col justify-center gap-0.5">
        <button
          className="btn btn-ghost btn-xs px-1"
          onClick={() => onMove(index, -1)}
          disabled={pending || index === 0}
          aria-label="Aukštyn"
        >
          <LuChevronUp size={14} />
        </button>
        <button
          className="btn btn-ghost btn-xs px-1"
          onClick={() => onMove(index, 1)}
          disabled={pending || last}
          aria-label="Žemyn"
        >
          <LuChevronDown size={14} />
        </button>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image ?? ""}
        alt=""
        className={`h-14 w-14 shrink-0 rounded object-cover ${
          dropped ? "grayscale" : ""
        }`}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          {dropped && (
            <span className="badge badge-warning badge-xs shrink-0">
              dingo iš srauto
            </span>
          )}
          {pick.state === "out_of_stock" && (
            <span className="badge badge-ghost badge-xs shrink-0">neturima</span>
          )}
        </div>
        <div className="text-xs text-base-content/50">
          {[pick.brand_name, pick.merchant_name].filter(Boolean).join(" · ")}
          {pick.price != null && ` · ${pick.price} €`}
          {dropped && "nebėra kataloge"}
        </div>

        <input
          className="input input-bordered input-xs mt-1.5 w-full"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => {
            if (reason !== (pick.reason ?? "")) onReason(pick.product_id, reason);
          }}
          placeholder="Kodėl būtent šis? — rodoma ant kortelės"
        />
      </div>

      <button
        className="btn btn-ghost btn-xs self-center text-error"
        onClick={() => onRemove(pick.product_id)}
        disabled={pending}
        aria-label="Pašalinti"
      >
        <LuTrash2 size={14} />
      </button>
    </li>
  );
}
