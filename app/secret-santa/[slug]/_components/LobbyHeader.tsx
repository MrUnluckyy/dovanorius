// app/secret-santa/[slug]/_components/LobbyHeader.tsx
import type { SsEvent } from "@/types/secret-santa";
import { useTranslations } from "next-intl";

export default function LobbyHeader({ ev }: { ev: SsEvent }) {
  const t = useTranslations("SecretSanta");
  return (
    <div className="card bg-secondary text-secondary-content shadow">
      <figure className="">
        <img src="/assets/christmasv2.png" alt="Christmas illustration" />
      </figure>
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h2 className="card-title font-special text-2xl">{ev.name}</h2>
          <div className="badge">{t(ev.status)}</div>
        </div>
        <p className="text-sm opacity-70">
          {t("budget", { amount: ev.budget || "-" })}{" "}
          {ev.event_date ? `· ${ev.event_date}` : ""}
        </p>
      </div>
    </div>
  );
}
