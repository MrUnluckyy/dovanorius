"use client";

import { useTranslations } from "next-intl";
import { LuShuffle, LuUsers, LuShieldBan, LuX } from "react-icons/lu";

/**
 * The last look before names are drawn.
 *
 * Replaces a generic "Draw names?" dialog. Groups kept discovering a missing
 * rule only after everyone had seen who they got — one made three events in
 * an afternoon to fix it. So this shows what the draw will use, puts editing
 * the rules one tap away, and says plainly what "final" means: a redraw is
 * possible only until somebody looks.
 */
export default function DrawConfirmSheet({
  count,
  rules,
  busy,
  onConfirm,
  onEditRules,
  onClose,
}: {
  /** Confirmed people in the draw. */
  count: number;
  /** Who-can't-draw-whom rules set for this event. */
  rules: number;
  busy?: boolean;
  onConfirm: () => void;
  onEditRules: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("Events");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-(--nr-ink)/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draw-confirm-title"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-[28px] bg-(--nr-surface) pb-[env(safe-area-inset-bottom)] sm:max-w-[440px] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 px-5 pt-5">
          <span
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-(--nr-yellow-soft) text-(--nr-gold-strong)"
            aria-hidden
          >
            <LuShuffle size={18} />
          </span>
          <h2 id="draw-confirm-title" className="nr-h3 flex-1 pt-1.5 text-[18px]">
            {t("drawConfirmTitle")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="grid h-8 w-8 place-items-center rounded-full text-(--nr-muted) transition hover:bg-(--nr-tile) hover:text-(--nr-ink)"
          >
            <LuX />
          </button>
        </header>

        <ul className="mx-5 mt-4 divide-y divide-(--nr-border) rounded-[18px] border border-(--nr-border)">
          <li className="flex items-center gap-3 px-4 py-3 text-[15px] text-(--nr-ink)">
            <LuUsers className="shrink-0 text-(--nr-muted)" aria-hidden />
            {t("drawConfirmPeople", { count })}
          </li>
          <li className="flex items-center gap-3 px-4 py-3 text-[15px] text-(--nr-ink)">
            <LuShieldBan className="shrink-0 text-(--nr-muted)" aria-hidden />
            <span className="flex-1">
              {rules > 0 ? t("drawConfirmRules", { count: rules }) : t("drawConfirmNoRules")}
            </span>
            <button
              type="button"
              onClick={onEditRules}
              className="shrink-0 cursor-pointer text-[14px] font-semibold text-(--nr-ink) underline underline-offset-2"
            >
              {rules > 0 ? t("drawConfirmEditRules") : t("drawConfirmAddRules")}
            </button>
          </li>
        </ul>

        <p className="px-5 pt-4 text-[14px] leading-relaxed text-(--nr-ink-2)">
          {t("drawConfirmFinal")}
        </p>

        <div className="flex flex-col gap-2 px-5 pb-6 pt-5 sm:flex-row-reverse">
          <button
            onClick={onConfirm}
            disabled={busy}
            className="nr-btn nr-btn-dark flex-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("drawNames")}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="nr-btn nr-btn-outline flex-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("drawConfirmNotYet")}
          </button>
        </div>
      </div>
    </div>
  );
}
