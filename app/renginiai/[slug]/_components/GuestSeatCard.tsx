"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { FaGoogle } from "react-icons/fa6";
import { LuX } from "react-icons/lu";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { reportError } from "@/lib/report";

const DISMISSED_KEY = "noriuto_guest_card_dismissed";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Tells someone without an account how they get back, and offers one.
 *
 * Only an offer: they can stay as they are, and the emailed link keeps working.
 * It matters that an anonymous guest can see the address and fix a typo, since
 * that address is their only way back in from another device.
 */
export default function GuestSeatCard({
  user,
  slug,
  eventId,
}: {
  user: User;
  slug: string;
  eventId: string;
}) {
  const supabase = createClient();
  const t = useTranslations("Events");
  const isAnon = user.is_anonymous === true;
  const hasGoogle = !!user.identities?.some((i) => i.provider === "google");
  const eligible = isAnon || (user.user_metadata?.guest_link === true && !hasGoogle);

  const [hidden, setHidden] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eligible) return;
    setHidden(window.localStorage.getItem(DISMISSED_KEY) === user.id);
    if (!isAnon) return;
    supabase
      .rpc("ss_my_guest_email", { p_event_id: eventId })
      .then(({ data }) => setAddress((data as string | null) ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, eventId, isAnon, user.id]);

  if (!eligible || hidden) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, user.id);
    setHidden(true);
  };

  const save = async () => {
    const value = draft.trim();
    if (!EMAIL_RE.test(value)) {
      setError(t("inviteInvalidEmail"));
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc(
      "ss_set_my_guest_email",
      { p_event_id: eventId, p_email: value }
    );
    setSaving(false);
    const result = data as { ok?: boolean; error?: string } | null;
    if (rpcError || !result?.ok) {
      if (result?.error === "email_has_account") {
        setError(t("guestCardEmailHasAccount"));
      } else {
        setError(t("guestCardSaveFailed"));
        reportError({
          area: "auth",
          reason: "guest_email_change_failed",
          detail: { code: rpcError?.code, error: result?.error },
          contactEmail: value,
        });
      }
      return;
    }
    setAddress(value.toLowerCase());
    setEditing(false);
  };

  const continueWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_WEB_URL}/api/auth/callback?next=${encodeURIComponent(
          `/renginiai/${slug}`
        )}`,
      },
    });

  return (
    <div className="relative rounded-[20px] bg-(--nr-tile) px-5 py-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("guestCardDismiss")}
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-(--nr-on-yellow-muted) transition hover:bg-(--nr-surface)"
      >
        <LuX className="h-4 w-4" aria-hidden />
      </button>

      <p className="pr-8 font-heading text-[15px] font-bold text-(--nr-ink)">
        {t(isAnon ? "guestCardTitle" : "guestCardLinkedTitle")}
      </p>
      <p className="mt-1 text-[14px] leading-relaxed text-(--nr-on-yellow-muted)">
        {isAnon
          ? address
            ? t.rich("guestCardBody", {
                email: address,
                b: (chunks) => (
                  <strong className="text-(--nr-ink) [overflow-wrap:anywhere]">{chunks}</strong>
                ),
              })
            : t("guestCardBodyNoEmail")
          : t("guestCardLinkedBody")}
      </p>

      {isAnon && !editing && (
        <button
          type="button"
          onClick={() => {
            setDraft(address ?? "");
            setEditing(true);
          }}
          className="mt-1 text-[13px] font-semibold text-(--nr-gold-strong) underline underline-offset-2"
        >
          {t(address ? "guestCardChangeEmail" : "guestCardAddEmail")}
        </button>
      )}

      {editing && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("joinEmailPlaceholder")}
            className="min-w-0 flex-1 rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-surface) px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-(--nr-faint) focus:border-(--nr-yellow-deep)"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="nr-btn nr-btn-dark nr-btn-sm shrink-0 disabled:opacity-50"
          >
            {saving ? t("savingEvent") : t("guestCardSave")}
          </button>
        </div>
      )}
      {error && (
        <p className="mt-2 text-[13px] text-(--nr-danger,#b42318)" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={continueWithGoogle}
          className="nr-btn nr-btn-dark nr-btn-sm gap-2"
        >
          <FaGoogle aria-hidden />
          {t("guestCardGoogle")}
        </button>
        <Link
          href={isAnon ? "/registracija" : "/naujas-slaptazodis"}
          className="nr-btn nr-btn-outline nr-btn-sm"
        >
          {t(isAnon ? "guestCardRegister" : "guestCardSetPassword")}
        </Link>
      </div>
    </div>
  );
}
