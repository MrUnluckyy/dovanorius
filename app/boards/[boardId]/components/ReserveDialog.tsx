"use client";

import { useTranslations } from "next-intl";
import { LuX } from "react-icons/lu";
import { ReserveForm, type ReserveOutcome } from "./ReserveForm";
import type { Item } from "./WishList";

/**
 * Standalone wrapper around ReserveForm, for the Reserve button on a wish card
 * — the one place the form isn't already inside a modal. Inside the item modal
 * the form renders inline instead (see ViewItemModal): a dialog on top of a
 * dialog looked like a bug.
 */
export function ReserveDialog({
  item,
  boardName,
  open,
  onClose,
  onConfirm,
  isPending,
}: {
  item: Item;
  boardName?: string | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (email: string, password?: string) => Promise<ReserveOutcome>;
  isPending: boolean;
}) {
  const t = useTranslations("Boards");

  if (!open) return null;

  return (
    <dialog open className="modal modal-bottom sm:modal-middle">
      {/* The box clips so the rounded corners survive the edge-to-edge bands,
          and an inner wrapper does the scrolling. Scrolling the box itself
          would drag the close button out of view with the form — and once the
          account fields unfold, the form is taller than the viewport. */}
      <div className="modal-box max-w-md p-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <button
          type="button"
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10"
          onClick={onClose}
          aria-label={t("ctaClose")}
        >
          <LuX />
        </button>

        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <ReserveForm
            item={item}
            boardName={boardName}
            variant="dialog"
            isPending={isPending}
            onConfirm={onConfirm}
            onDone={onClose}
          />
        </div>
      </div>
      <div className="modal-backdrop bg-black/40" onClick={onClose}>
        <button type="button">{t("ctaClose")}</button>
      </div>
    </dialog>
  );
}
