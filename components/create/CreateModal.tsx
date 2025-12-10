// app/components/CreateModal.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WishForm } from "./Forms/WishForm";
import { BoardForm } from "./Forms/BoardForm";
import Link from "next/link";
import { LuGift } from "react-icons/lu";
import { LuHeart, LuLayoutGrid, LuCalendar } from "react-icons/lu";

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
    router.push("/secret-santa");
  };

  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg">
        {step === "options" && (
          <>
            <h3 className="font-bold text-lg mb-6 text-center">
              Ką nori sukurti?
            </h3>

            <div className="grid gap-3">
              <button
                className="btn btn-outline justify-start flex items-center gap-3 py-4"
                onClick={() => setStep("noras")}
              >
                <LuHeart className="text-xl" />
                <span className="text-md">Norą</span>
              </button>

              <button
                className="btn btn-outline justify-start flex items-center gap-3 py-4"
                onClick={() => setStep("lenta")}
              >
                <LuLayoutGrid className="text-xl" />
                <span className="text-md">Lentą</span>
              </button>

              <button
                className="btn btn-outline justify-start flex items-center gap-3 py-4"
                onClick={handleRenginys}
              >
                <LuCalendar className="text-xl" />
                <span className="text-md">Renginį</span>
              </button>
            </div>

            <div className="modal-action">
              <button className="btn" onClick={handleClose}>
                Atšaukti
              </button>
            </div>
          </>
        )}

        {step === "noras" && (
          <>
            <h3 className="font-bold text-lg mb-4">Naujas noras</h3>
            <WishForm onCancel={handleClose} onSuccess={handleClose} />
          </>
        )}

        {step === "lenta" && (
          <>
            <h3 className="font-bold text-lg mb-4">Nauja lenta</h3>
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
