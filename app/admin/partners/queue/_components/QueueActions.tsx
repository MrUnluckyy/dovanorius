"use client";

import { useRef, useState, useTransition } from "react";
import { LuCheck, LuX } from "react-icons/lu";
import toast from "react-hot-toast";
import { approveProduct, rejectProduct } from "../actions";

export function QueueActions({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  function handleApprove() {
    startTransition(async () => {
      try {
        await approveProduct(productId);
        toast.success("Patvirtinta — produktas įtrauktas į srautą.");
      } catch {
        toast.error("Nepavyko patvirtinti.");
      }
    });
  }

  function handleReject() {
    dialogRef.current?.close();
    startTransition(async () => {
      try {
        await rejectProduct(productId, reason);
        toast.success("Atmesta.");
        setReason("");
      } catch {
        toast.error("Nepavyko atmesti.");
      }
    });
  }

  return (
    <>
      <div className="flex justify-end gap-1">
        <button
          className="btn btn-success btn-xs gap-1"
          onClick={handleApprove}
          disabled={pending}
        >
          <LuCheck size={13} /> Patvirtinti
        </button>
        <button
          className="btn btn-ghost btn-xs gap-1 text-error"
          onClick={() => dialogRef.current?.showModal()}
          disabled={pending}
        >
          <LuX size={13} /> Atmesti
        </button>
      </div>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-md">
          <h3 className="font-heading text-lg font-bold">Atmesti produktą</h3>
          <p className="mt-1 text-sm text-base-content/60">
            Priežastis bus matoma partneriui.
          </p>
          <textarea
            className="textarea textarea-bordered mt-3 w-full"
            rows={3}
            placeholder="pvz. netinkama nuotrauka, per aukšta kaina…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
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
              className="btn btn-error btn-sm"
              onClick={handleReject}
            >
              Atmesti
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
