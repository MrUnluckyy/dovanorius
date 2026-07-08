import Link from "next/link";
import Image from "next/image";

type EventType = "secret_santa" | "name_draw" | "group" | string | null;

const TYPE_META: Record<string, { icon: string; bg: string }> = {
  secret_santa: { icon: "🎅", bg: "bg-primary/10" },
  name_draw: { icon: "🎲", bg: "bg-secondary/10" },
  group: { icon: "🎁", bg: "bg-accent/10" },
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
  const { icon, bg } = getTypeMeta(type);

  // Whole card is the link — people expect to click the card, not just a button.
  return (
    <Link
      href={url}
      className="card bg-base-100 shadow-sm overflow-hidden transition-shadow hover:shadow-md"
    >
      <div className={`relative h-28 flex items-center justify-center ${bg}`}>
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 45vw, 240px"
            className="object-cover"
          />
        ) : (
          <span className="text-5xl">{icon}</span>
        )}
      </div>
      <div className="card-body p-3 gap-2">
        <h2 className="card-title text-sm leading-tight line-clamp-2">
          {title}
        </h2>
      </div>
    </Link>
  );
}
