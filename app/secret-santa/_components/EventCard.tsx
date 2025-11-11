import { SsEvent } from "@/types/secret-santa";
import Link from "next/link";

export default function EventCard({ ev }: { ev: SsEvent }) {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h2 className="card-title">{ev.name}</h2>
          <div className="badge badge-outline">{ev.status}</div>
        </div>
        <p className="text-sm opacity-70">
          Budget: {ev.budget ?? "—"} {ev.currency ?? "EUR"}{" "}
          {ev.event_date ? `· ${ev.event_date}` : ""}
        </p>
        <div className="card-actions justify-end">
          <Link className="btn btn-ghost" href={`/secret-santa/${ev.slug}`}>
            Open
          </Link>
          <Link
            className="btn btn-primary"
            href={`/secret-santa/${ev.slug}/my`}
          >
            My recipient
          </Link>
        </div>
      </div>
    </div>
  );
}
