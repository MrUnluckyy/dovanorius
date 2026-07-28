// app/components/CreateModal.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WishForm } from "./Forms/WishForm";
import { BoardForm } from "./Forms/BoardForm";
import {
  LuHeart,
  LuLayoutGrid,
  LuCalendar,
  LuChevronRight,
  LuX,
} from "react-icons/lu";

type Step = "options" | "noras" | "lenta";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateModal({ isOpen, onClose }: CreateModalProps) {
  const [step, setStep] = useState<Step>("options");
  const router = useRouter();

  const handleClose = () => {
    setStep("options");
    onClose();
  };

  const handleRenginys = () => {
    handleClose();
    router.push("/events");
  };

  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg p-6 sm:p-8">
        <button
          type="button"
          className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"
          onClick={handleClose}
          aria-label="Uždaryti"
        >
          <LuX className="text-lg" />
        </button>

        {step === "options" && (
          <>
            <h3 className="font-heading font-bold text-2xl text-center">
              Ką nori sukurti?
            </h3>
            <p className="text-center text-base-content/60 mt-1 mb-6">
              Pasirink, ką šiandien kuriam ✨
            </p>

            <div className="grid gap-3">
              {CREATE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    if (option.key === "renginys") return handleRenginys();
                    setStep(option.key as Step);
                  }}
                  className="group flex w-full items-center gap-4 rounded-xl border border-base-300 bg-base-100 p-4 text-left transition hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${option.iconClass}`}
                  >
                    {option.icon}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-heading font-semibold text-base">
                      {option.title}
                    </span>
                    <span className="text-sm text-base-content/60">
                      {option.description}
                    </span>
                  </span>
                  <LuChevronRight className="ml-auto text-xl text-base-content/30 transition group-hover:translate-x-0.5 group-hover:text-base-content" />
                </button>
              ))}
            </div>

            <div className="mt-6 text-center">
              <button className="btn btn-ghost btn-sm" onClick={handleClose}>
                Atšaukti
              </button>
            </div>
          </>
        )}

        {step === "noras" && (
          <>
            <h3 className="font-heading font-bold text-xl mb-4">Naujas noras</h3>
            <WishForm onCancel={handleClose} onSuccess={handleClose} />
          </>
        )}

        {step === "lenta" && (
          <>
            <h3 className="font-heading font-bold text-xl mb-4">Nauja lenta</h3>
            <BoardForm onCancel={handleClose} onSuccess={handleClose} />
          </>
        )}
      </div>

      {/* clicking outside closes */}
      <form method="dialog" className="modal-backdrop" onSubmit={handleClose}>
        <button>close</button>
      </form>
    </dialog>
  );
}

const CREATE_OPTIONS = [
  {
    key: "noras",
    title: "Norą",
    description: "Pridėk dovanos idėją į savo lentą",
    icon: <LuHeart className="text-xl" />,
    iconClass: "bg-secondary text-secondary-content",
  },
  {
    key: "lenta",
    title: "Lentą",
    description: "Sukurk naują norų sąrašą",
    icon: <LuLayoutGrid className="text-xl" />,
    iconClass: "bg-accent/20 text-accent",
  },
  {
    key: "renginys",
    title: "Renginį",
    description: "Organizuok dovanų mainus su draugais",
    icon: <LuCalendar className="text-xl" />,
    iconClass: "bg-info text-info-content",
  },
] as const;
