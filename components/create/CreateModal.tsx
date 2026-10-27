// app/components/CreateModal.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { WishForm } from "./Forms/WishForm";
import { BoardForm } from "./Forms/BoardForm";
import { Hero3D, type Hero3DName } from "@/components/ui/Hero3D";
import { LuChevronRight, LuX } from "react-icons/lu";

type Step = "options" | "wish" | "board";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CREATE_OPTIONS: {
  key: Step | "event";
  hero: Hero3DName;
  title: "wishTitle" | "boardTitle" | "eventTitle";
  subtitle: "wishSubtitle" | "boardSubtitle" | "eventSubtitle";
}[] = [
  { key: "wish", hero: "gift", title: "wishTitle", subtitle: "wishSubtitle" },
  { key: "board", hero: "memo", title: "boardTitle", subtitle: "boardSubtitle" },
  { key: "event", hero: "party", title: "eventTitle", subtitle: "eventSubtitle" },
];

export function CreateModal({ isOpen, onClose }: CreateModalProps) {
  const [step, setStep] = useState<Step>("options");
  const router = useRouter();
  const t = useTranslations("Create");

  const handleClose = () => {
    setStep("options");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open modal-bottom sm:modal-middle">
      <div className="modal-box max-w-lg p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-8">
        <button
          type="button"
          className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 z-10"
          onClick={handleClose}
          aria-label={t("close")}
        >
          <LuX className="text-lg" />
        </button>

        {step === "options" && (
          <>
            <h3 className="font-heading font-bold text-2xl text-center">
              {t("title")}
            </h3>
            <p className="text-center text-(--nr-muted) mt-1 mb-6">
              {t("subtitle")}
            </p>

            <div className="grid gap-3">
              {CREATE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    if (option.key === "event") {
                      handleClose();
                      router.push("/renginiai/naujas");
                      return;
                    }
                    setStep(option.key);
                  }}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-(--nr-border) bg-(--nr-surface) p-3.5 text-left transition hover:border-(--nr-yellow-deep) hover:bg-(--nr-tile)/40 hover:shadow-[var(--nr-shadow-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--nr-yellow-deep) focus-visible:ring-offset-2"
                >
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-(--nr-tile) transition group-hover:scale-105">
                    <Hero3D name={option.hero} size={40} still />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-heading font-semibold text-base">
                      {t(option.title)}
                    </span>
                    <span className="text-sm text-(--nr-muted)">
                      {t(option.subtitle)}
                    </span>
                  </span>
                  <LuChevronRight className="ml-auto shrink-0 text-xl text-(--nr-muted) transition group-hover:translate-x-0.5 group-hover:text-base-content" />
                </button>
              ))}
            </div>
          </>
        )}

        {step === "wish" && (
          <WishForm onCancel={handleClose} onSuccess={handleClose} />
        )}

        {step === "board" && (
          <>
            <h3 className="font-heading font-bold text-xl mb-4">{t("newBoard")}</h3>
            <BoardForm
              onCancel={handleClose}
              onSuccess={(board) => {
                handleClose();
                router.push(`/lentos/${board.id}`);
              }}
            />
          </>
        )}
      </div>

      {/* clicking outside closes */}
      <div className="modal-backdrop" onClick={handleClose} />
    </dialog>
  );
}
