import type { SsEvent } from "@/types/secret-santa";
import { useTranslations } from "next-intl";

export default function LobbyHeader({ ev }: { ev: SsEvent }) {
  const t = useTranslations("SecretSanta");
  return (
    <div className="card bg-secondary text-secondary-content shadow overflow-hidden">
      <div className="card-body min-h-[300px] bg-[url('/assets/christmas/christmas-cover.svg')] bg-center bg-cover justify-center items-center">
        <div className="">
          <h2 className="text-3xl font-special text-accent-content">
            {ev.name}
          </h2>
        </div>
      </div>
    </div>
  );
}
