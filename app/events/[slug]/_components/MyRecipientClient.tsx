"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import RevealCard from "../_components/RevealCard";
import { qq } from "@/utils/qq";
import { createClient } from "@/utils/supabase/client";

export default function MyRecipientClient({ slug }: { slug: string }) {
  const sb = createClient();
  const t = useTranslations("Events");

  const { data: ev } = useQuery({
    queryKey: qq.event(slug),
    queryFn: async () =>
      // Selects the whole row, not a subset: this shares qq.event(slug) with
      // the lobby, and a partial object cached under that key would hand the
      // lobby an event with no join_token.
      (await sb.from("ss_events").select("*").eq("slug", slug).single()).data!,
  });

  const { data: mine } = useQuery({
    enabled: !!ev?.id,
    queryKey: qq.myAssignment(ev?.id ?? "x", "me"),
    queryFn: async () => {
      const { data } = await sb
        .from("ss_my_assignment")
        .select("*")
        .eq("event_id", ev!.id)
        .maybeSingle();
      if (!data) return null;
      const profile = await sb
        .from("profiles")
        .select("id,display_name,avatar_url")
        .eq("id", data.receiver)
        .single();
      return { receiver: profile.data };
    },
  });

  if (!ev) return null;

  return (
    <div className="mx-auto flex max-w-[440px] flex-col items-center gap-5 px-4 py-10">
      <h1 className="nr-h2 text-center text-[28px]">{ev.name}</h1>
      {mine?.receiver ? (
        <RevealCard person={mine.receiver} type={ev.type} />
      ) : (
        <p className="nr-card w-full px-5 py-6 text-center text-[15px] text-(--nr-muted)">
          {ev.status !== "drawn" ? t("drawWaiting") : t("drawnNoAssignment")}
        </p>
      )}
    </div>
  );
}
