"use client";

import { useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { LuRotateCcw } from "react-icons/lu";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { qq } from "@/utils/qq";
import { redraw } from "../draw/actions";

/**
 * The organiser's one way back after a draw: only while nobody — themselves
 * included — has looked at who they got. Rendered by the lobby only in that
 * window; ss_redraw() enforces the same rule in the database, so a member who
 * reveals while this is on screen simply turns the redraw into a refusal.
 */
export default function RedrawPanel({
  slug,
  eventId,
  onEditRules,
}: {
  slug: string;
  eventId: string;
  onEditRules: () => void;
}) {
  const t = useTranslations("Events");
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qq.event(slug) });
    qc.invalidateQueries({ queryKey: ["ss:myAssignment", eventId] });
    qc.invalidateQueries({ queryKey: ["ss:revealedCount", eventId] });
  };

  const go = async () => {
    const ok = await confirm({
      title: t("redrawConfirmTitle"),
      message: t("redrawConfirmBody"),
      confirmText: t("redrawCta"),
    });
    if (!ok) return;
    start(async () => {
      const res = await redraw(slug);
      if (res.ok) {
        toast.success(t("redrawDone"));
      } else if (res.error === "already_revealed") {
        toast.error(t("redrawTooLate"));
      } else if (
        ["no_recipient", "household_too_big", "impossible_other", "too_few"].includes(res.error)
      ) {
        toast.error(t("drawImpossible"));
      } else {
        toast.error(t("drawFailed"));
      }
      refresh();
    });
  };

  return (
    <div className="nr-card mb-3 p-5">
      <p className="font-semibold text-(--nr-ink)">{t("redrawTitle")}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-(--nr-muted)">{t("redrawBody")}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onEditRules}
          disabled={pending}
          className="nr-btn nr-btn-outline flex-1 disabled:opacity-50"
        >
          {t("drawConfirmEditRules")}
        </button>
        <button
          onClick={go}
          disabled={pending}
          className="nr-btn nr-btn-dark flex-1 disabled:opacity-50"
        >
          <LuRotateCcw className="w-4" aria-hidden />
          {pending ? t("drawing") : t("redrawCta")}
        </button>
      </div>
    </div>
  );
}
