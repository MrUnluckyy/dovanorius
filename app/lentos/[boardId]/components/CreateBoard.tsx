"use client";
import { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuClipboardPlus, LuPlus, LuX } from "react-icons/lu";
import { BoardForm } from "@/components/create/Forms/BoardForm";

/**
 * "New board" on the boards list. Renders the shared BoardForm, so it carries
 * the same fields (privacy included) as the create menu.
 */
export function CreateBoard({
  user,
  small = false,
  quiet = false,
  label,
}: {
  user: User | null;
  /** Compact, for sitting beside a heading. */
  small?: boolean;
  /** White, secondary — for sitting next to a yellow primary action. */
  quiet?: boolean;
  /** Button text; defaults to "Sukurti naują lentą". */
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("Boards");

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        className={
          quiet
            ? "btn btn-sm relative shrink-0 gap-2 rounded-xl border-(--nr-border) before:absolute before:-inset-1.5 before:content-[''] sm:btn-md sm:before:hidden bg-(--nr-surface) font-semibold text-(--nr-ink) shadow-sm hover:border-(--nr-ink) hover:bg-(--nr-surface)"
            : `btn btn-primary shrink-0${small ? " btn-sm" : ""}`
        }
        onClick={() => setIsOpen(true)}
      >
        {quiet ? <LuClipboardPlus className="w-4" aria-hidden /> : <LuPlus />}
        {quiet ? (
          // Icon-only on the narrowest phones, where the label would overlap
          // the title beside it; still read out by screen readers.
          <span className="max-[359px]:sr-only">{label ?? t("ctaCreateBoard")}</span>
        ) : (
          (label ?? t("ctaCreateBoard"))
        )}
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
