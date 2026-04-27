import Link from "next/link";
import { useTranslations } from "next-intl";

type EventType = "secret_santa" | "name_draw" | "group_gift" | string | null;

const TYPE_META: Record<string, { icon: string; bg: string }> = {
  secret_santa: { icon: "🎅", bg: "bg-primary/10" },
  name_draw: { icon: "🎲", bg: "bg-secondary/10" },
  group_gift: { icon: "🎁", bg: "bg-accent/10" },
};

function getTypeMeta(type: EventType) {
  return TYPE_META[type ?? ""] ?? { icon: "🎉", bg: "bg-base-300" };
}

export function EventCard({
  title,
  url,
  type,
  coverImageUrl,
}: {
  title: string;
  url: string;
  type: EventType;
  coverImageUrl?: string | null;
}) {
  const t = useTranslations("Dashboard");
  const { icon, bg } = getTypeMeta(type);

  return (
    <div className="card bg-base-100 shadow-sm overflow-hidden">
      <div className={`h-28 flex items-center justify-center ${bg}`}>
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-5xl">{icon}</span>
        )}
      </div>
      <div className="card-body p-3 gap-2">
        <h2 className="card-title text-sm leading-tight line-clamp-2">
          {title}
        </h2>
        <div className="card-actions">
          <Link href={url} className="btn btn-primary btn-xs w-full">
            {t("openButton")}
          </Link>
        </div>
      </div>
    </div>
  );
}
