"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { LuCheck, LuChevronDown } from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { qq } from "@/utils/qq";

/**
 * "What I'd like", for this event only.
 *
 * Deliberately not a wish list. A wish list is durable, reusable and yours —
 * links, images, reservations — and it stays an account feature. This is one
 * disposable line scoped to one exchange, which is all a giver actually needs
 * and the only thing a guest can have: it lives on their ss_members row, which
 * they already own, so it needs no account, no board and no new table.
 */
export default function MyWishNote({
  eventId,
  userId,
  initial,
  hasWishlist,
}: {
  eventId: string;
  userId: string;
  initial: string | null;
  hasWishlist: boolean;
}) {
  const sb = createClient();
  const qc = useQueryClient();
  const t = useTranslations("Events");
  const [value, setValue] = useState(initial ?? "");
  const [justSaved, setJustSaved] = useState(false);

  // Prominence follows whether the giver has anything else to look at, not
  // whether you hold an account: somebody with a wish list already answers the
  // question, and a second box at the same weight competes with it. Somebody
  // without one — a guest, or an account holder with no public board — is
  // writing the only thing their giver gets, so it stays open.
  const [open, setOpen] = useState(!hasWishlist || !!initial);

  useEffect(() => setValue(initial ?? ""), [initial]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await sb
        .from("ss_members")
        .update({ wants: value.trim() || null })
        .eq("event_id", eventId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qq.members(eventId) });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    },
    onError: () => toast.error(t("wishNoteSaveFailed")),
  });

  const dirty = (initial ?? "") !== value;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="nr-card flex w-full items-center gap-2 px-5 py-3.5 text-left text-[15px] font-medium text-(--nr-muted) transition hover:text-(--nr-ink)"
      >
        <LuChevronDown className="w-4 shrink-0 text-(--nr-faint)" />
        {t("wishNoteAddForEvent")}
      </button>
    );
  }

  return (
    <div className="nr-card p-5">
      <h2 className="nr-h3 text-[16px]">{t("wishNoteTitle")}</h2>
      <p className="mt-1 text-[14px] leading-relaxed text-(--nr-muted)">
        {hasWishlist ? t("wishNoteBodyWithList") : t("wishNoteBody")}
      </p>

      <textarea
        rows={3}
        value={value}
        maxLength={500}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("wishNotePlaceholder")}
        className="mt-3 w-full resize-y rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-cream) px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-(--nr-faint) focus:border-(--nr-yellow-deep)"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
          className="nr-btn nr-btn-outline nr-btn-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {save.isPending ? t("savingEvent") : t("wishNoteSave")}
        </button>
        {justSaved && !dirty && (
          <span className="flex items-center gap-1.5 text-[14px] font-semibold text-(--nr-success-ink)">
            <LuCheck size={14} />
            {t("wishNoteSaved")}
          </span>
        )}
      </div>
    </div>
  );
}
