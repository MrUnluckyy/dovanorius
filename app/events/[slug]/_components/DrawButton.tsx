"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { motion, useAnimationControls } from "framer-motion";
import toast from "react-hot-toast";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { createClient } from "@/utils/supabase/client";
import { qq } from "@/utils/qq";
import type { DrawCheck, Participant } from "@/types/secret-santa";
import { updateEvent } from "@/app/actions/events/manage";
import { runDraw } from "../draw/actions";
import DrawCheckSheet from "./DrawCheckSheet";

const CHECK_REASONS = new Set(["too_few", "no_recipient", "household_too_big", "impossible_other"]);

/**
 * Draw names, after asking the database whether the draw can work.
 *
 * ss_check_draw() runs first. "ok" goes straight to the usual confirmation and
 * the draw. Anything else opens DrawCheckSheet: impossible draws explain the
 * reason with the action that fixes it and never draw; relaxed and
 * predictable draws warn, and "Draw anyway" is the confirmation.
 */
export default function DrawButton({
  slug,
  eventId,
  participants,
  disabled,
  onInvite,
  onEditRules,
}: {
  slug: string;
  eventId: string;
  participants: Participant[];
  disabled?: boolean;
  onInvite: () => void;
  onEditRules: () => void;
}) {
  const sb = createClient();
  const [pending, start] = useTransition();
  const [spinning, setSpinning] = useState(false);
  const [check, setCheck] = useState<DrawCheck | null>(null);
  // Checking (and confirming) is not drawing: the label stays "Draw names".
  const [checking, setChecking] = useState(false);
  const qc = useQueryClient();
  const t = useTranslations("Events");
  const confirm = useConfirm();
  const ctrl = useAnimationControls();

  const nameOf = (id: string) =>
    participants.find((p) => p.user_id === id)?.display_name || t("invitePersonUnnamed");

  const fetchCheck = async (): Promise<DrawCheck | null> => {
    const { data, error } = await sb.rpc("ss_check_draw", { p_event_id: eventId });
    if (error || !data) {
      console.error("ss_check_draw failed:", error);
      return null;
    }
    return data as DrawCheck;
  };

  const draw = () =>
    start(async () => {
      setSpinning(true);
      await ctrl.start({ rotate: 360, transition: { duration: 0.6, ease: "easeInOut" } });
      try {
        const res = await runDraw(slug);
        if (!res.ok) {
          // The roster or rules can change between the check and the draw;
          // explain it the same way the check would have.
          if (CHECK_REASONS.has(res.error)) {
            const fresh = await fetchCheck();
            if (fresh && fresh.status === "impossible") {
              setCheck(fresh);
              return;
            }
          }
          toast.error(
            res.error === "impossible_exclusions" || CHECK_REASONS.has(res.error)
              ? t("drawImpossible")
              : t("drawFailed")
          );
          return;
        }
        setCheck(null);
        await ctrl.start({ scale: [1, 1.1, 1], transition: { duration: 0.4 } });
        qc.invalidateQueries({ queryKey: qq.event(slug) });
        qc.invalidateQueries({ queryKey: qq.participants(eventId) });
        qc.invalidateQueries({ queryKey: qq.members(eventId) });
        qc.invalidateQueries({ queryKey: ["ss:myAssignment", eventId] });
      } catch (err) {
        console.error("Draw failed:", err);
        toast.error(t("drawFailed"));
      } finally {
        setSpinning(false);
      }
    });

  const go = async () => {
    setChecking(true);
    try {
      const res = await fetchCheck();
      if (!res) {
        toast.error(t("drawFailed"));
        return;
      }
      if (res.status !== "ok") {
        setCheck(res);
        return;
      }
    } finally {
      setChecking(false);
    }
    // Drawing closes the roster and cannot be undone, so it still asks.
    const ok = await confirm({
      title: t("drawConfirmTitle"),
      message: t("drawConfirmBody"),
      confirmText: t("drawNames"),
    });
    if (ok) draw();
  };

  const turnOffRule = async () => {
    setChecking(true);
    const res = await updateEvent(slug, { avoid_previous_match: false });
    setChecking(false);
    if (!res.ok) {
      toast.error(t("settingsSaveFailed"));
      return;
    }
    qc.invalidateQueries({ queryKey: qq.event(slug) });
    setCheck(null);
    await go();
  };

  return (
    <>
      <motion.button
        animate={ctrl}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        onClick={go}
        disabled={disabled || pending || checking}
        className="nr-btn nr-btn-dark flex-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending || spinning ? t("drawing") : t("drawNames")}
      </motion.button>

      {check && (
        <DrawCheckSheet
          check={check}
          nameOf={nameOf}
          busy={pending || checking}
          onClose={() => setCheck(null)}
          onDrawAnyway={draw}
          onTurnOffRule={turnOffRule}
          onEditRules={() => {
            setCheck(null);
            onEditRules();
          }}
          onInvite={() => {
            setCheck(null);
            onInvite();
          }}
        />
      )}
    </>
  );
}
