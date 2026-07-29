"use client";

import { createClient } from "@/utils/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

type UseReserveItemArgs = {
  itemId: string;
  boardId: string;
  user?: User | null;
  /**
   * Returns a Turnstile token for the (invisible) captcha. Required when
   * reserving as a guest — a silent anonymous session is created first and we
   * gate that sign-in behind the captcha so bots can't spam it. Logged-in users
   * don't need it.
   */
  getCaptchaToken?: () => Promise<string | undefined>;
  /** Reset the captcha after a failed guest sign-in so it can be retried. */
  resetCaptcha?: () => void;
};

/**
 * Shared reserve/unreserve logic used by both the one-click card button and the
 * item detail modal, so the guest-session + captcha flow stays in one place.
 */
export function useReserveItem({
  itemId,
  boardId,
  user,
  getCaptchaToken,
  resetCaptcha,
}: UseReserveItemArgs) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations("Boards");
  const [isPending, setIsPending] = useState(false);

  const reserve = async (): Promise<boolean> => {
    setIsPending(true);
    try {
      // Guests can reserve without an account: create a silent anonymous
      // session on first reserve, gated behind the invisible captcha.
      if (!user) {
        let captchaToken: string | undefined;
        try {
          captchaToken = await getCaptchaToken?.();
        } catch (captchaError) {
          toast.error(t("errorReserve"));
          console.error("Captcha verification failed:", captchaError);
          return false;
        }

        const { error: authError } = await supabase.auth.signInAnonymously({
          options: { captchaToken },
        });
        if (authError) {
          toast.error(t("errorReserve"));
          console.error("Error creating guest session:", authError);
          resetCaptcha?.();
          return false;
        }
      }

      const { data, error } = await supabase.rpc("reserve_item", {
        p_item_id: itemId,
      });

      if (error) {
        toast.error(t("errorReserve"));
        console.error("Error reserving item:", error);
        return false;
      }
      if (data) {
        toast.success(t("successReserve"));
        queryClient.invalidateQueries({ queryKey: ["items", boardId] });
        // Re-render server components with the new (anonymous) session so the
        // "my reservation" state stays in sync.
        router.refresh();
        return true;
      }
      return false;
    } finally {
      setIsPending(false);
    }
  };

  const unreserve = async (): Promise<boolean> => {
    setIsPending(true);
    try {
      const { data, error } = await supabase.rpc("unreserve_item", {
        p_item_id: itemId,
      });
      if (error) {
        toast.error(t("errorUnreserve"));
        console.error("Error unreserving item:", error);
        return false;
      }
      if (data) {
        toast.success(t("successUnreserve"));
        queryClient.invalidateQueries({ queryKey: ["items", boardId] });
        return true;
      }
      return false;
    } finally {
      setIsPending(false);
    }
  };

  return { reserve, unreserve, isPending };
}
