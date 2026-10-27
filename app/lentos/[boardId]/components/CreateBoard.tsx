"use client";
import { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuPlus, LuX } from "react-icons/lu";
import { BoardForm } from "@/components/create/Forms/BoardForm";

/**
 * "New board" on the boards list. Renders the shared BoardForm, so it carries
 * the same fields (privacy included) as the create menu.
 */
export function CreateBoard({
  user,
  small = false,
}: {
  user: User | null;
  /** Compact, for sitting beside a heading. */
  small?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("Boards");

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        className={`btn btn-primary shrink-0${small ? " btn-sm" : ""}`}
        onClick={() => setIsOpen(true)}
      >
        <LuPlus />
        {t("ctaCreateBoard")}
      </button>

      {isOpen && (
        <dialog open className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box max-w-lg p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-8">
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"
              onClick={() => setIsOpen(false)}
              aria-label={t("ctaClose")}
            >
              <LuX className="text-lg" />
            </button>
            <h3 className="font-heading mb-4 text-xl font-bold">
              {t("createBoardTitle")}
            </h3>
            <BoardForm
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
