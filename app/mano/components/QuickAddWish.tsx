"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LuArrowRight, LuLink, LuX } from "react-icons/lu";
import { WishForm } from "@/components/create/Forms/WishForm";
import { Hero3D } from "@/components/ui/Hero3D";

/**
 * The dashboard's main action, in reach without a menu: paste a link here
 * and the wish flow opens already fetching it, or go "by hand".
 */
export function QuickAddWish() {
  const t = useTranslations("Dashboard");
  const tw = useTranslations("Wish");
  const [link, setLink] = useState("");
  const [open, setOpen] = useState<null | { url?: string; manual?: boolean }>(null);

  const start = (url: string) => {
    if (!url.trim()) return;
    setOpen({ url: url.trim() });
    setLink("");
  };

  return (
    <>
      <section className="flex flex-col gap-4 rounded-3xl bg-(--nr-tile) p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <div className="flex items-center gap-3 sm:w-56 sm:shrink-0">
          <Hero3D name="gift" size={48} still />
          <div>
            <h2 className="font-heading text-lg font-bold leading-tight">
              {t("quickAddTitle")}
            </h2>
            <button
              type="button"
              onClick={() => setOpen({ manual: true })}
              className="text-sm text-(--nr-gold-strong) underline decoration-(--nr-yellow-deep) underline-offset-2 hover:text-base-content"
            >
              {t("quickAddManual")}
            </button>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(link);
          }}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border-2 border-transparent bg-(--nr-surface) p-1.5 pl-3.5 shadow-sm transition focus-within:border-(--nr-yellow-deep)"
        >
          <LuLink className="w-4 shrink-0 text-(--nr-muted)" aria-hidden />
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text").trim();
              if (/^(https?:\/\/|www\.)\S+$/i.test(pasted)) {
                e.preventDefault();
                start(pasted);
              }
            }}
            placeholder={tw("linkPlaceholder")}
            aria-label={tw("linkLabel")}
            className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-(--nr-faint)"
          />
          <button
            type="submit"
            disabled={!link.trim()}
            className="btn btn-primary btn-sm h-10 shrink-0 rounded-xl px-4"
          >
            <span className="hidden sm:inline">{tw("linkCta")}</span>
            <LuArrowRight className="w-4" />
          </button>
        </form>
      </section>

      {open && (
        <dialog open className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box max-w-lg p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-8">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 z-10"
              onClick={() => setOpen(null)}
              aria-label={tw("back")}
            >
              <LuX className="text-lg" />
            </button>
            <WishForm
              initialUrl={open.url}
              startManual={open.manual}
              onCancel={() => setOpen(null)}
              onSuccess={() => setOpen(null)}
            />
          </div>
          <div className="modal-backdrop" onClick={() => setOpen(null)} />
        </dialog>
      )}
    </>
  );
}
