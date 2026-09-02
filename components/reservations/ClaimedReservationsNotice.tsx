"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

/**
 * Says out loud that holds made as a guest have been moved into the account
 * just signed into. Without it the gifts simply appear, and "why is this
 * reserved by me?" is a worse question than the one we set out to answer.
 *
 * Mounted globally because sign-in returns people to wherever they were —
 * a board, a wish, the dashboard.
 */
export function ClaimedReservationsNotice() {
  const t = useTranslations("Boards");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const claimed = Number(params.get("claimed"));
    if (!Number.isInteger(claimed) || claimed < 1) return;

    toast.success(t("reservationsClaimed", { count: claimed }));

    // Spend the param, so a refresh doesn't announce it twice.
    params.delete("claimed");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (query ? `?${query}` : "")
    );
  }, [t]);

  return null;
}
