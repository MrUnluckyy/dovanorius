import { SsEvent } from "@/types/secret-santa";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { getEventTypeMeta } from "@/utils/events/typeMeta";

const STATUS_KEY: Record<SsEvent["status"], string> = {
  draft: "statusDraft",
  open: "statusOpen",
  locked: "statusLocked",
  drawn: "statusDrawn",
  archived: "statusArchived",
};

export default function EventCard({ ev }: { ev: SsEvent }) {
  const t = useTranslations("Events");
  const meta = getEventTypeMeta(ev.type);

  return (
    <Link
      href={`/events/${ev.slug}`}
      className="card card-side bg-base-100 shadow hover:shadow-md transition-shadow overflow-hidden"
    >
      <figure className="w-24 shrink-0 bg-base-200 flex items-center justify-center">
        {ev.cover_image_url ? (
          <img
            src={ev.cover_image_url}
            alt={ev.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-3xl" aria-hidden>
            {meta.emoji}
          </span>
        )}
      </figure>
      <div className="card-body p-4 gap-1">
        <div className="flex items-start justify-between gap-2">
          <h2 className="card-title text-base">{ev.name}</h2>
          <div className="badge badge-outline whitespace-nowrap">
            {t(STATUS_KEY[ev.status])}
          </div>
        </div>
        <p className="text-sm opacity-70">
          {t(meta.labelKey)}
          {meta.showBudget && ev.budget != null
            ? ` · ${ev.budget} ${ev.currency ?? "EUR"}`
            : ""}
          {ev.event_date ? ` · ${ev.event_date}` : ""}
        </p>
      </div>
    </Link>
  );
}
