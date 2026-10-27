"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuX } from "react-icons/lu";
import { WishForm } from "@/components/create/Forms/WishForm";

/**
 * A board's "Add wish" button. The flow itself is the shared WishForm (link
 * or by hand) with the board fixed, so it can't drift from the create menu.
 */
export function AddItemModal({
  boardId,
  children,
  className = "btn btn-primary",
}: {
  boardId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("Boards");

  return (
    <>
      <button className={className} onClick={() => setIsOpen(true)}>
        {children}
      </button>
      {isOpen && (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-lg p-6 sm:p-8">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 z-10"
              onClick={() => setIsOpen(false)}
              aria-label={t("ctaClose")}
            >
              <LuX className="text-lg" />
            </button>
            <WishForm
              fixedBoardId={boardId}
              onCancel={() => setIsOpen(false)}
              onSuccess={() => setIsOpen(false)}
            />
          </div>
          <div className="modal-backdrop" onClick={() => setIsOpen(false)} />
        </dialog>
      )}
    </>
  );
}
