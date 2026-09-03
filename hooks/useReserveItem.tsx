"use client";

import { createClient } from "@/utils/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { reportError } from "@/lib/report";
import { errorToast } from "@/components/feedback/errorToast";

/** Where we remember a guest's address so their second reserve is one tap. */
export const GUEST_EMAIL_KEY = "noriuto_guest_email";

export function readRememberedGuestEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(GUEST_EMAIL_KEY) ?? "";
  } catch {
    return ""; // private mode / storage disabled
  }
}

function rememberGuestEmail(email: string) {
  try {
    window.localStorage.setItem(GUEST_EMAIL_KEY, email);
  } catch {
    // Not being able to remember is not worth failing a reservation over.
  }
}

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
  /**
   * Magic-link token, when the giver arrived via /b/s/<token>. It is what
   * authorises them on a board that is shared but not public.
   */
  shareToken?: string | null;
};

export type ReserveResult = {
  ok: boolean;
  expiresAt?: string | null;
  /** Set on failure, so callers can react (e.g. open the email dialog). */
  error?: string;
  /** The guest also asked for an account and it was created. */
  accountCreated?: boolean;
  /** The account could not be made. The reservation itself still stands. */
  accountError?: "email_taken" | "failed";
};

/**
 * Shared reserve/unreserve logic used by both the one-click card button and the
 * item detail modal, so the guest-session + captcha flow stays in one place.
 *
 * Reserving now always carries an email address: guests type one, signed-in
 * givers have theirs read from their account server-side. Without it we have no
 * way to tell someone their hold is about to lapse, which is precisely how
 * people lost gifts they thought were theirs.
 */
export function useReserveItem({
  itemId,
  boardId,
  user,
  getCaptchaToken,
  resetCaptcha,
  shareToken,
}: UseReserveItemArgs) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations("Boards");
  const tf = useTranslations("Feedback");
  const locale = useLocale();
  const [isPending, setIsPending] = useState(false);

  /**
   * Guests have no address on file — anonymous sessions carry no email — so
   * they have to give one. That includes a returning guest whose anonymous
   * session is still alive.
   */
  const needsEmail = !user || user.is_anonymous === true;

  /**
   * Turns the guest's anonymous session into a real account, keeping the same
   * auth.uid() — which is why this runs AFTER the reservation rather than
   * sending them to /register first. Registration needs email verification, so
   * a redirect would take them off the site with the gift still unheld.
   */
  const upgradeGuestAccount = async (
    email: string,
    password: string
  ): Promise<Pick<ReserveResult, "accountCreated" | "accountError">> => {
    // Carry the locale: the Send Email hook has no other way to know which
    // language to confirm this address in.
    const { error } = await supabase.auth.updateUser({
      email,
      password,
      data: { locale },
    });
    if (!error) {
      router.refresh();
      return { accountCreated: true };
    }
    console.error("Guest account upgrade failed:", error);
    const taken =
      error.code === "email_exists" ||
      /already been registered|already registered|already in use/i.test(
        error.message
      );
    return { accountError: taken ? "email_taken" : "failed" };
  };

  /**
   * Every unexpected reserve failure, reported the same way: the beacon tells
   * us, and the toast offers the person the one thing they can add — what they
   * were trying to do. The address they just typed prefills the reply-to.
   */
  const failReserve = (
    reason: string,
    detail: Record<string, unknown> = {},
    contactEmail?: string
  ) => {
    reportError({ area: "reserve", reason, detail: { itemId, boardId, ...detail } });
    errorToast({
      title: t("errorReserve"),
      body: t("errorReserveDesc"),
      reportLabel: tf("reportCta"),
      context: {
        area: "reserve",
        reason,
        detail: { itemId, boardId, ...detail },
        contactEmail,
      },
    });
  };

  const reserve = async (
    email?: string,
    password?: string
  ): Promise<ReserveResult> => {
    setIsPending(true);
    try {
      // Guests can reserve without an account: create a silent anonymous
      // session on first reserve, gated behind the invisible captcha.
      if (!user) {
        let captchaToken: string | undefined;
        try {
          captchaToken = await getCaptchaToken?.();
        } catch (captchaError) {
          console.error("Captcha verification failed:", captchaError);
          failReserve("captcha_failed", {}, email?.trim() || undefined);
          return { ok: false, error: "captcha_failed" };
        }

        const { error: authError } = await supabase.auth.signInAnonymously({
          options: { captchaToken },
        });
        if (authError) {
          console.error("Error creating guest session:", authError);
          failReserve(
            "auth_failed",
            { message: authError.message },
            email?.trim() || undefined
          );
          resetCaptcha?.();
          return { ok: false, error: "auth_failed" };
        }
      }

      const trimmedEmail = email?.trim() ?? "";

      const { data, error } = await supabase.rpc("reserve_item_with_contact", {
        p_item_id: itemId,
        p_email: trimmedEmail || null,
        p_share_token: shareToken ?? null,
      });

      if (error) {
        console.error("Error reserving item:", error);
        // The FK failure that took guest reserving down for fifteen hours
        // landed exactly here, and went no further than someone's console.
        failReserve(
          "rpc_failed",
          { code: error.code, message: error.message },
          trimmedEmail || undefined
        );
        return { ok: false, error: "rpc_failed" };
      }

      const result = data as
        | { ok: true; expires_at: string; email: string }
        | { ok: false; error: string };

      if (!result?.ok) {
        const reason = result?.error;

        // The caller opens the dialog for this one — a toast telling someone
        // their address is missing, with nowhere to type it, helps nobody.
        // Reached when a signed-in account has no address on file.
        if (reason === "email_required") return { ok: false, error: reason };

        if (reason === "invalid_email") {
          toast.error(t("reserveEmailInvalid"));
        } else if (reason === "unavailable") {
          // Somebody reserved it first, or the wish moved on. Re-fetch so the
          // card stops offering a stale action.
          toast.error(t("reserveTakenError"));
          queryClient.invalidateQueries({ queryKey: ["items", boardId] });
        } else {
          console.error("Reserve rejected:", reason);
          failReserve(
            reason ? `rejected:${reason}` : "rejected:unknown",
            {},
            trimmedEmail || undefined
          );
        }
        return { ok: false, error: reason };
      }

      if (trimmedEmail) rememberGuestEmail(trimmedEmail);

      toast.success(t("successReserve"));
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
      // Re-render server components with the new (anonymous) session so the
      // "my reservation" state stays in sync.
      router.refresh();

      // Confirmation email, best-effort: the reservation is already made and
      // must not be undone because an inbox was unreachable.
      void fetch("/api/reservations/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      }).catch((err) => console.error("Confirmation email failed:", err));

      // Optional, and never allowed to fail the reservation.
      const account =
        password && trimmedEmail
          ? await upgradeGuestAccount(trimmedEmail, password)
          : {};

      return { ok: true, expiresAt: result.expires_at, ...account };
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

  return { reserve, unreserve, isPending, needsEmail };
}
