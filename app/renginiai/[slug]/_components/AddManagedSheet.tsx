"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { LuEye, LuListChecks, LuX } from "react-icons/lu";
import { addManagedMember } from "@/app/actions/events/managed";
import { qq } from "@/utils/qq";

/**
 * Add somebody by name who will never sign in — a grandparent, a child.
 * The organiser looks after them: sees who they drew and keeps their wish
 * list. The sheet says plainly that the organiser will know that one pairing.
 */
export default function AddManagedSheet({
  slug,
  eventId,
  hasWishlists,
  onClose,
}: {
  slug: string;
  eventId: string;
  /** Secret Santa only: a name draw has no gifts and so no wish list. */
  hasWishlists: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Events");
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  // State updates land on the next render; two taps in one instant would both
  // see busy === false and add the person twice.
  const busyRef = useRef(false);
  const canSubmit = !!name.trim() && !busy;

  const submit = async () => {
    if (!canSubmit || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const res = await addManagedMember(slug, name);
    if (!res.ok) {
      busyRef.current = false;
      setBusy(false);
      toast.error(
        res.error === "event_closed"
          ? t("managedAddClosed")
          : res.error === "rate_limited"
          ? t("managedAddRateLimited")
          : t("managedAddFailed")
      );
      return;
    }
    toast.success(t("managedAdded", { name: name.trim() }));
    qc.invalidateQueries({ queryKey: qq.participants(eventId) });
    qc.invalidateQueries({ queryKey: qq.members(eventId) });
    qc.invalidateQueries({ queryKey: ["ss:managed", eventId] });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-(--nr-ink)/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="managed-title"
      onClick={busy ? undefined : onClose}
    >
      <form
        className="w-full rounded-t-[28px] bg-(--nr-surface) sm:max-w-[460px] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <header className="flex items-center gap-3 border-b border-(--nr-border) px-5 py-4">
          <h2 id="managed-title" className="nr-h3 flex-1 text-[19px]">
            {t("managedAddTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("close")}
            className="grid h-8 w-8 place-items-center rounded-full text-(--nr-muted) transition hover:bg-(--nr-tile) hover:text-(--nr-ink)"
          >
            <LuX />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <p className="text-[15px] leading-relaxed text-(--nr-muted)">
            {t("managedAddBody")}
          </p>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-(--nr-ink)">
              {t("managedNameLabel")}
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder={t("managedNamePlaceholder")}
              className="w-full rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-cream) px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-(--nr-faint) focus:border-(--nr-yellow-deep)"
              data-testid="managed-name"
            />
          </label>

          <ul className="space-y-2.5 rounded-[16px] bg-(--nr-cream) px-4 py-3.5 text-[14px] leading-relaxed text-(--nr-ink-2)">
            <li className="flex gap-2.5">
              <LuEye className="mt-0.5 w-4 shrink-0 text-(--nr-gold-strong)" />
              <span>{t("managedAddSeesDraw")}</span>
            </li>
            {hasWishlists && (
              <li className="flex gap-2.5">
                <LuListChecks className="mt-0.5 w-4 shrink-0 text-(--nr-gold-strong)" />
                <span>{t("managedAddWishlist")}</span>
              </li>
            )}
          </ul>
        </div>

        <footer className="flex gap-2 border-t border-(--nr-border) px-5 pb-[max(1.1rem,env(safe-area-inset-bottom))] pt-3">
          <button type="button" onClick={onClose} disabled={busy} className="nr-btn nr-btn-outline flex-1">
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="nr-btn nr-btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("managedAddCta")}
          </button>
        </footer>
      </form>
    </div>
  );
}
