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
  variant = "button",
}: {
  user: User | null;
  /** "tile" is the dashed card that sits in the boards grid. */
  variant?: "button" | "tile";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("Boards");

  if (!user) return null;

  return (
    <>
      {variant === "tile" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex min-h-[140px] w-full flex-col sm:min-h-[260px] items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-(--nr-border) p-6 text-center transition hover:border-(--nr-yellow-deep) hover:bg-(--nr-tile)/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--nr-yellow-deep)"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-(--nr-yellow) text-(--nr-ink) shadow-[var(--nr-shadow-btn)] transition group-hover:scale-105">
            <LuPlus className="w-5" />
          </span>
          <span className="font-heading text-lg font-bold">{t("ctaCreateBoard")}</span>
          <span className="max-w-[16rem] text-sm text-(--nr-muted)">
            {t("boardTitlePlaceholder")}
          </span>
        </button>
      ) : (
        <button className="btn btn-primary" onClick={() => setIsOpen(true)}>
          <LuPlus />
          {t("ctaCreateBoard")}
        </button>
      )}

      {isOpen && (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-lg p-6 sm:p-8">
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
