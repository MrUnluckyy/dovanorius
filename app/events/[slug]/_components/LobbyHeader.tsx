import type { SsEvent } from "@/types/secret-santa";
import { useFormatter, useTranslations } from "next-intl";
import { LuCalendar, LuGift, LuSettings, LuUsers } from "react-icons/lu";
import { getEventTypeMeta } from "@/utils/events/typeMeta";

const STATUS_KEY: Record<SsEvent["status"], string> = {
  draft: "statusDraft",
  open: "statusOpen",
  locked: "statusLocked",
  drawn: "statusDrawn",
  archived: "statusArchived",
};

/**
 * The event's identity, and the facts people keep coming back to check:
 * when it is, how much to spend, how many are in.
 */
export default function LobbyHeader({
  ev,
  joinedCount,
  canManage,
  onOpenSettings,
}: {
  ev: SsEvent;
  joinedCount: number;
  canManage: boolean;
  onOpenSettings: () => void;
}) {
  const t = useTranslations("Events");
  const format = useFormatter();
  const meta = getEventTypeMeta(ev.type);
  const date = ev.event_date ? new Date(ev.event_date) : null;
  const showBudget = meta.showBudget && ev.budget != null;

  return (
    <header className="nr-card overflow-hidden">
      <div
        className="relative flex min-h-[180px] flex-col items-center justify-center gap-3 bg-(--nr-tile) bg-cover bg-center px-6 py-9 text-center"
        style={
          ev.cover_image_url
            ? { backgroundImage: `url('${ev.cover_image_url}')` }
            : undefined
        }
      >
        {ev.cover_image_url && (
          <div className="absolute inset-0 bg-(--nr-ink)/45" aria-hidden />
        )}

        {canManage && (
          <button
            onClick={onOpenSettings}
            aria-label={t("settingsTitle")}
            className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-(--nr-surface)/90 text-(--nr-ink) transition hover:bg-(--nr-surface)"
          >
            <LuSettings size={16} />
          </button>
        )}

        <div className="relative flex flex-col items-center gap-2.5">
          <span
            className="grid h-12 w-12 place-items-center rounded-full bg-(--nr-surface) text-2xl shadow-[var(--nr-shadow-hover)]"
            aria-hidden
          >
            {meta.emoji}
          </span>
          <h1
            className={`nr-h2 text-[26px] leading-tight md:text-[30px] ${
              ev.cover_image_url ? "text-white" : ""
            }`}
          >
            {ev.name}
          </h1>
          <span
            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
              ev.cover_image_url
                ? "bg-(--nr-surface)/90 text-(--nr-ink)"
                : "bg-(--nr-surface) text-(--nr-gold-strong)"
            }`}
          >
            {t(STATUS_KEY[ev.status])}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-(--nr-border) border-t border-(--nr-border)">
        <Fact
          icon={<LuUsers size={14} />}
          label={t("joinPeopleLabel")}
          value={String(joinedCount)}
        />
        <Fact
          icon={<LuCalendar size={14} />}
          label={t("fieldDate")}
          value={
            date
              ? format.dateTime(date, { day: "numeric", month: "long" })
              : "—"
          }
        />
        <Fact
          icon={<LuGift size={14} />}
          label={t("fieldBudgetShort")}
          value={showBudget ? `${ev.budget} ${ev.currency ?? "EUR"}` : "—"}
        />
      </dl>
    </header>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="px-3 py-3.5 text-center">
      <dt className="flex items-center justify-center gap-1.5 text-[12px] text-(--nr-faint)">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-heading text-[16px] font-bold text-(--nr-ink)">
        {value}
      </dd>
    </div>
  );
}
