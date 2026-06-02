"use client";

import { useState, useTransition } from "react";
import {
  resolveReservation,
  type ReservationAction,
  type ResolveResult,
} from "@/app/r/actions";

const COPY: Record<
  ReservationAction,
  { prompt: string; cta: string; pending: string }
> = {
  keep: {
    prompt: "Ar nori palikti šią rezervaciją dar 30 dienų?",
    cta: "Taip, palikti rezervaciją",
    pending: "Paliekama…",
  },
  release: {
    prompt: "Ar nori atlaisvinti šią rezervaciją? Ją galės pasiimti kiti.",
    cta: "Taip, atlaisvinti",
    pending: "Atlaisvinama…",
  },
};

const RESULT_MESSAGE: Record<ResolveResult["status"], string> = {
  kept: "✅ Rezervacija palikta. Ačiū!",
  released: "✅ Rezervacija atlaisvinta. Ją galės pasiimti kiti.",
  gone: "Ši rezervacija jau nebegalioja arba buvo atlaisvinta anksčiau.",
  invalid: "Nuoroda nebegalioja. Patikrink, ar atidarei naujausią laišką.",
};

export function ReservationActionForm({
  token,
  action,
  itemTitle,
}: {
  token: string;
  action: ReservationAction;
  itemTitle: string;
}) {
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const copy = COPY[action];

  const onConfirm = () => {
    startTransition(async () => {
      try {
        setResult(await resolveReservation(token, action));
      } catch {
        setResult({ status: "invalid" });
      }
    });
  };

  if (result) {
    return (
      <div className="card bg-base-200 shadow-sm max-w-md mx-auto">
        <div className="card-body items-center text-center">
          <p>{RESULT_MESSAGE[result.status]}</p>
          <a href="https://noriuto.lt" className="btn btn-primary mt-2">
            Į Noriuto
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-200 shadow-sm max-w-md mx-auto">
      <div className="card-body items-center text-center">
        <h1 className="card-title">{itemTitle}</h1>
        <p>{copy.prompt}</p>
        <button
          className={`btn mt-2 ${action === "release" ? "btn-warning" : "btn-primary"}`}
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending ? copy.pending : copy.cta}
        </button>
      </div>
    </div>
  );
}
