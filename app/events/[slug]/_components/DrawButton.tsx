"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { motion, useAnimationControls } from "framer-motion";
import toast from "react-hot-toast";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { qq } from "@/utils/qq";
import { runDraw } from "../draw/actions";

export default function DrawButton({
  slug,
  eventId,
  disabled,
}: {
  slug: string;
  eventId: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [spinning, setSpinning] = useState(false);
  const qc = useQueryClient();
  const t = useTranslations("Events");
  const confirm = useConfirm();
  const ctrl = useAnimationControls();

  const go = async () => {
    // Drawing closes the roster and cannot be undone, so it asks first —
    // it used to fire on a single tap.
    const ok = await confirm({
      title: t("drawConfirmTitle"),
      message: t("drawConfirmBody"),
      confirmText: t("drawNames"),
    });
    if (!ok) return;

    start(async () => {
      setSpinning(true);
      await ctrl.start({
        rotate: 360,
        transition: { duration: 0.6, ease: "easeInOut" },
      });
      try {
        const res = await runDraw(slug);
        if (!res.ok) {
          // The action reports its failures rather than throwing them: a
          // thrown message never survives to the client in production.
          toast.error(
            res.error === "impossible_exclusions"
              ? t("drawImpossible")
              : res.error === "too_few"
              ? t("drawNeedMoreConfirmed")
              : t("drawFailed")
          );
          return;
        }
        await ctrl.start({ scale: [1, 1.1, 1], transition: { duration: 0.4 } });
        // Refresh what the draw actually changed, rather than every query in
        // the app — the old call was an un-keyed invalidateQueries().
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
  };

  return (
    <motion.button
      animate={ctrl}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={go}
      disabled={disabled || pending}
      className="nr-btn nr-btn-dark flex-1 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending || spinning ? t("drawing") : t("drawNames")}
    </motion.button>
  );
}
