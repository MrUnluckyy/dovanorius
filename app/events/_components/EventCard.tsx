import { SsEvent } from "@/types/secret-santa";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { getEventTypeMeta } from "@/utils/events/typeMeta";

const STATUS_KEY: Record<SsEvent["status"], string> = {
  draft: "statusDraft",
  open: "statusOpen",
  locked: "statusLocked",
  drawn: "statusDrawn",
  archived: "statusArchived",
};

export default function EventCard({
  ev,
  memberCount,
}: {
  ev: SsEvent;
  memberCount?: number;
}) {
  const t = useTranslations("Events");
  const format = useFormatter();
  const meta = getEventTypeMeta(ev.type);
  const date = ev.event_date ? new Date(ev.event_date) : null;

  // Status is the useful signal on a list: whether this one still needs people,
  // or is waiting on the organiser, or is finished.
  const statusTone =
    ev.status === "drawn"
      ? "bg-(--nr-success-soft) text-(--nr-success-ink)"
      : ev.status === "open"
      ? "bg-(--nr-tile) text-(--nr-gold-strong)"
      : "bg-(--nr-cream) text-(--nr-muted)";

  return (
    <Link
      href={`/events/${ev.slug}`}
      className="nr-card nr-card-hover flex items-stretch gap-0 overflow-hidden"
    >
      <div
        className="grid w-24 shrink-0 place-items-center bg-(--nr-tile) bg-cover bg-center sm:w-28"
        style={
          ev.cover_image_url
            ? { backgroundImage: `url('${ev.cover_image_url}')` }
            : undefined
        }
      >
        {!ev.cover_image_url && (
          <span className="text-3xl" aria-hidden>
            {meta.emoji}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate font-heading text-[17px] font-bold text-(--nr-ink)">
            {ev.name}
          </h3>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusTone}`}
          >
            {t(STATUS_KEY[ev.status])}
          </span>
        </div>

        <p className="mt-1 truncate text-[14px] text-(--nr-muted)">
          {[
            t(meta.labelKey),
            memberCount != null
              ? t("joinPeopleCount", { count: memberCount })
              : null,
            date
              ? format.dateTime(date, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : null,
            meta.showBudget && ev.budget != null
              ? `${ev.budget} ${ev.currency ?? "EUR"}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}
