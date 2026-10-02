"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LuX } from "react-icons/lu";
import DatePicker from "@/components/DatePicker";
import { maxEventDate, todayInVilnius } from "@/lib/events/formatEventDate";

/**
 * Confirm next year's edition before anything is created: the name (editable,
 * pre-filled with the year bumped), the date (required, pre-filled with the
 * same day next year) and how many people will be invited.
 */
export default function RepeatEventSheet({
  initialName,
  initialDate,
  invitees,
  busy,
  onCancel,
  onConfirm,
}: {
  initialName: string;
  initialDate: string | null;
  invitees: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (input: { name: string; eventDate: string }) => void;
}) {
  const t = useTranslations("Events");
  const [name, setName] = useState(initialName);
  const [date, setDate] = useState(initialDate ?? "");
  const canSubmit = !!name.trim() && !!date && !busy;

  const field =
    "w-full rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-cream) px-3.5 py-2.5 text-[15px] outline-none transition focus:border-(--nr-yellow-deep)";
  const label = "mb-1.5 block text-[13px] font-semibold text-(--nr-ink)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-(--nr-ink)/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="repeat-title"
      onClick={busy ? undefined : onCancel}
    >
      <form
        className="w-full rounded-t-[28px] bg-(--nr-surface) sm:max-w-[460px] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onConfirm({ name: name.trim(), eventDate: date });
        }}
      >
        <header className="flex items-center gap-3 border-b border-(--nr-border) px-5 py-4">
          <h2 id="repeat-title" className="nr-h3 flex-1 text-[19px]">
            {t("repeatEventSheetTitle")}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label={t("close")}
            className="grid h-8 w-8 place-items-center rounded-full text-(--nr-muted) transition hover:bg-(--nr-tile) hover:text-(--nr-ink)"
          >
            <LuX />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className={label}>{t("fieldName")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className={field}
              data-testid="repeat-name"
            />
          </label>

          <div>
            <span id="repeat-date-label" className={label}>
              {t("fieldDate")}
            </span>
            <DatePicker
              id="repeat-date"
              labelledBy="repeat-date-label"
              value={date}
              onChange={setDate}
              min={todayInVilnius()}
              max={maxEventDate()}
              clearable={false}
              className={field}
            />
          </div>

          <p className="text-[14px] leading-relaxed text-(--nr-muted)">
            {t("repeatEventConfirmBody", { count: invitees })}
          </p>
        </div>

        <footer className="flex gap-2 border-t border-(--nr-border) px-5 pb-[max(1.1rem,env(safe-area-inset-bottom))] pt-3">
          <button type="button" onClick={onCancel} disabled={busy} className="nr-btn nr-btn-outline flex-1">
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="nr-btn nr-btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {invitees > 0 ? t("repeatEventConfirmCta") : t("repeatEventConfirmCtaNoInvites")}
          </button>
        </footer>
      </form>
    </div>
  );
}
