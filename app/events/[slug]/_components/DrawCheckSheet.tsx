"use client";

import { useLocale, useTranslations } from "next-intl";
import { LuTriangleAlert, LuCircleX, LuX } from "react-icons/lu";
import type { DrawCheck } from "@/types/secret-santa";

/**
 * What stands between the organiser and a draw, in their terms.
 *
 * Shown when ss_check_draw() says the draw is impossible (with the one action
 * that fixes it), or possible but worth a second look: relaxed (someone gets
 * the same person as last year) or predictable (only one draw fits, so it can
 * be worked out). A plain "ok" never opens this.
 *
 * `people` arrives as user ids; names come from the participants the lobby has
 * already loaded.
 */
export default function DrawCheckSheet({
  check,
  nameOf,
  busy,
  onClose,
  onDrawAnyway,
  onTurnOffRule,
  onEditRules,
  onInvite,
}: {
  check: DrawCheck;
  nameOf: (userId: string) => string;
  busy?: boolean;
  onClose: () => void;
  onDrawAnyway: () => void;
  onTurnOffRule: () => void;
  onEditRules: () => void;
  onInvite: () => void;
}) {
  const t = useTranslations("Events");
  const locale = useLocale();
  const list = (ids: string[]) =>
    new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(ids.map(nameOf));

  const blocked = check.status === "impossible";

  let title: string;
  let body: string;
  let actions: { label: string; onClick: () => void; primary?: boolean }[];

  switch (check.reason ?? check.status) {
    case "too_few":
      title = t("drawCheckTooFewTitle");
      body = t("drawCheckTooFew", { min: check.min ?? 0, count: check.count });
      actions = [{ label: t("drawCheckInvite"), onClick: onInvite, primary: true }];
      break;
    case "no_recipient":
      title = t("drawCheckNoRecipientTitle");
      body = t("drawCheckNoRecipient", { name: list(check.people.slice(0, 1)), count: check.people.length });
      actions = [{ label: t("drawCheckEditRules"), onClick: onEditRules, primary: true }];
      break;
    case "household_too_big":
      title = t("drawCheckHouseholdTitle");
      body = t("drawCheckHousehold", {
        names: list(check.people),
        k: check.people.length,
        n: check.count,
      });
      actions = [
        { label: t("drawCheckEditRules"), onClick: onEditRules, primary: true },
        { label: t("drawCheckInvite"), onClick: onInvite },
      ];
      break;
    case "impossible_other":
      title = t("drawCheckOtherTitle");
      body = t("drawCheckOther");
      actions = [{ label: t("drawCheckEditRules"), onClick: onEditRules, primary: true }];
      break;
    case "relaxed":
      title = t("drawCheckRelaxedTitle");
      body = t("drawCheckRelaxed", { repeats: check.repeats });
      actions = [
        { label: t("drawCheckDrawAnyway"), onClick: onDrawAnyway, primary: true },
        { label: t("drawCheckTurnOffRule"), onClick: onTurnOffRule },
      ];
      break;
    default: // predictable
      title = t("drawCheckPredictableTitle");
      body = t("drawCheckPredictable");
      actions = [
        { label: t("drawCheckDrawAnyway"), onClick: onDrawAnyway, primary: true },
        { label: t("drawCheckEditRules"), onClick: onEditRules },
      ];
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-(--nr-ink)/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draw-check-title"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-[28px] bg-(--nr-surface) sm:max-w-[440px] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 px-5 pt-5">
          <span
            className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${
              blocked
                ? "bg-(--nr-error-soft) text-(--nr-error-ink)"
                : "bg-(--nr-yellow-soft) text-(--nr-gold-strong)"
            }`}
            aria-hidden
          >
            {blocked ? <LuCircleX size={18} /> : <LuTriangleAlert size={18} />}
          </span>
          <h2 id="draw-check-title" className="nr-h3 flex-1 pt-1.5 text-[18px]">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="grid h-8 w-8 place-items-center rounded-full text-(--nr-muted) transition hover:bg-(--nr-tile) hover:text-(--nr-ink)"
          >
            <LuX />
          </button>
        </header>

        <p className="px-5 pt-3 text-[15px] leading-relaxed text-(--nr-ink-2)">{body}</p>

        <div className="flex flex-col gap-2 px-5 pb-6 pt-5 sm:flex-row-reverse">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              disabled={busy}
              className={`nr-btn flex-1 disabled:cursor-not-allowed disabled:opacity-50 ${
                a.primary ? "nr-btn-dark" : "nr-btn-outline"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
