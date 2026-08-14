"use client";

import { useRef, useState, useTransition } from "react";
import { LuCheckCheck } from "react-icons/lu";
import toast from "react-hot-toast";
import { approveAllPending } from "../actions";

export type PendingPartner = {
  id: string;
  name: string;
  count: number;
};

const ALL = "__all__";

export function QueueBulkActions({
  partners,
  total,
}: {
  partners: PendingPartner[];
  total: number;
}) {
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<string>(
    partners.length === 1 ? partners[0].id : ALL
  );
  const dialogRef = useRef<HTMLDialogElement>(null);

  const selected = partners.find((p) => p.id === scope);
  const count = selected ? selected.count : total;

  function handleApproveAll() {
    dialogRef.current?.close();
    startTransition(async () => {
      try {
        const approved = await approveAllPending(
          scope === ALL ? undefined : scope
        );
        toast.success(`Patvirtinta ${approved} — įtraukti į srautą.`);
      } catch {
        toast.error("Nepavyko patvirtinti visų.");
      }
    });
  }

  return (
    <>
      <button
        className="btn btn-success btn-sm gap-1"
        onClick={() => dialogRef.current?.showModal()}
        disabled={pending || total === 0}
      >
        <LuCheckCheck size={15} /> Patvirtinti visus
      </button>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-md">
          <h3 className="font-heading text-lg font-bold">
            Patvirtinti visus produktus
          </h3>
          <p className="mt-1 text-sm text-base-content/60">
            Patvirtinti produktai iškart įtraukiami į Discover srautą. Šio
            veiksmo atšaukti negalima — kiekvieną produktą tektų atmesti atskirai.
          </p>

          {partners.length > 1 && (
            <label className="form-control mt-4 w-full">
              <span className="label-text text-sm">Apimtis</span>
              <select
                className="select select-bordered w-full"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value={ALL}>Visi partneriai ({total})</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.count})
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="alert alert-warning mt-4 py-2 text-sm">
            Bus patvirtinta <strong>{count}</strong>{" "}
            {selected ? `„${selected.name}" produktų` : "produktų"}.
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => dialogRef.current?.close()}
            >
              Atšaukti
            </button>
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={handleApproveAll}
              disabled={count === 0}
            >
              Patvirtinti {count}
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
