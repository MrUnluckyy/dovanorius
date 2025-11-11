// app/secret-santa/[slug]/_components/LobbyHeader.tsx
import type { SsEvent } from "@/types/secret-santa";

export default function LobbyHeader({ ev }: { ev: SsEvent }) {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h2 className="card-title">{ev.name}</h2>
          <div className="badge">{ev.status}</div>
        </div>
        <p className="text-sm opacity-70">
          Budget: {ev.budget ?? "—"} {ev.currency ?? "EUR"}{" "}
          {ev.event_date ? `· ${ev.event_date}` : ""}
        </p>
      </div>
    </div>
  );
}
