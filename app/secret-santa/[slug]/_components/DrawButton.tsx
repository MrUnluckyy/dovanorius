// app/secret-santa/[slug]/_components/DrawButton.tsx
"use client";
import { useTransition } from "react";
import { runDraw } from "../draw/actions";
import { motion, useAnimationControls } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

export default function DrawButton({
  slug,
  disabled,
}: {
  slug: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const qc = useQueryClient();
  const ctrl = useAnimationControls();

  const go = () =>
    start(async () => {
      await ctrl.start({
        rotate: 360,
        transition: { duration: 0.6, ease: "easeInOut" },
      });
      const res = await runDraw(slug);
      await ctrl.start({ scale: [1, 1.1, 1], transition: { duration: 0.4 } });
      if (res.ok) {
        // invalidate lobby + my pages
        qc.invalidateQueries(); // simple nuke
      } else {
        alert("Draw failed");
      }
    });

  return (
    <motion.button
      animate={ctrl}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      onClick={go}
      disabled={disabled || pending}
      className={`btn btn-secondary ${pending ? "loading" : ""}`}
    >
      {pending ? "Traukiama..." : "Užrakinti ir Traukti"}
    </motion.button>
  );
}
