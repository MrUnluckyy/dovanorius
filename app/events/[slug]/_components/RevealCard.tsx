"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ConfettiBurst } from "../../_components/Confetti";
import type { SsEventType } from "@/types/secret-santa";

type Stage = "idle" | "rolling" | "reveal";

export default function RevealCard({
  person,
  type = "secret_santa",
}: {
  person: { id: string; display_name?: string; avatar_url?: string };
  type?: SsEventType;
}) {
  const t = useTranslations("Events");
  // Only Secret Santa points to a wish list — Name Draw has no gifts.
  const showWishlist = type === "secret_santa";
  // Slot-roll names for suspense
  const pool = useMemo(
    () => [
      "👀",
      "Draugas",
      "Bičiulis",
      "Kaimynas",
      "Partneris",
      "Kolega",
      "Mylimasis",
    ],
    []
  );
  const [stage, setStage] = useState<Stage>("idle");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (stage !== "rolling") return;
    const t = setInterval(() => setTick((x) => x + 1), 120);
    const done = setTimeout(() => {
      clearInterval(t);
      localStorage.setItem("ss-reveal-stage", stage);

      setStage("reveal");
    }, 2000);
    return () => {
      clearInterval(t);
      clearTimeout(done);
    };
  }, [stage]);

  const face =
    stage === "reveal"
      ? person.display_name ?? "Recipient"
      : pool[tick % pool.length];

  return (
    <div className="card bg-base-100 shadow-xl w-full md:min-w-md">
      <div className="card-body items-center text-center">
        <div className="card-title">
          {showWishlist ? t("revealTitle") : t("drawRecipientLabel")}
        </div>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={face}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-3xl font-bold h-10"
          >
            {face}
          </motion.div>
        </AnimatePresence>

        {stage === "reveal" && <ConfettiBurst burstKey={person.id} />}

        <div className="avatar mt-4">
          <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
            {stage === "reveal" && person.avatar_url ? (
              <img src={person.avatar_url} alt="avatar" />
            ) : (
              <div className="skeleton w-24 h-24 rounded-full" />
            )}
          </div>
        </div>

        <div className="card-actions mt-6">
          {stage === "idle" && (
            <button
              className="btn btn-primary"
              onClick={() => setStage("rolling")}
            >
              {t("revealBtn")}
            </button>
          )}
          {stage === "reveal" && showWishlist && (
            <a
              className="btn btn-secondary"
              href={`/users/${person.id}?tab=wishlist`}
            >
              {t("viewWishlist")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
