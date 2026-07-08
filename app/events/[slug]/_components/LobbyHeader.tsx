import type { SsEvent } from "@/types/secret-santa";
import { useTranslations } from "next-intl";
import { getEventTypeMeta } from "@/utils/events/typeMeta";

export default function LobbyHeader({ ev }: { ev: SsEvent }) {
  const t = useTranslations("Events");
  const meta = getEventTypeMeta(ev.type);

  return (
    <div className="card bg-secondary text-secondary-content shadow overflow-hidden">
      <div
        className="card-body min-h-[300px] bg-center bg-cover justify-center items-center relative"
        style={
          ev.cover_image_url
            ? { backgroundImage: `url('${ev.cover_image_url}')` }
            : meta.type === "secret_santa"
            ? {
                backgroundImage: "url('/assets/christmas/christmas-cover.svg')",
              }
            : undefined
        }
      >
        {/* Darken so the title stays readable over a photo cover. */}
        {ev.cover_image_url && (
          <div className="absolute inset-0 bg-black/35" aria-hidden />
        )}
        <div className="relative flex flex-col items-center gap-3">
          <span className="badge badge-neutral gap-1">
            <span aria-hidden>{meta.emoji}</span>
            {t(meta.labelKey)}
          </span>
          <h2 className="text-3xl font-heading text-center text-accent-content">
            {ev.name}
          </h2>
        </div>
      </div>
    </div>
  );
}
