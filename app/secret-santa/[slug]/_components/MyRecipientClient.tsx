"use client";
import { useQuery } from "@tanstack/react-query";
import RevealCard from "../_components/RevealCard";
import { qq } from "@/utils/qq";
import { createClient } from "@/utils/supabase/client";

export default function MyRecipientClient({ slug }: { slug: string }) {
  const sb = createClient();

  const { data: ev } = useQuery({
    queryKey: qq.event(slug),
    queryFn: async () =>
      (
        await sb
          .from("ss_events")
          .select("id,name,status")
          .eq("slug", slug)
          .single()
      ).data!,
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
    <div className="max-w-md mx-auto p-6 flex flex-col justify-center items-center gap-4">
      <h1 className="font-special text-5xl mb-8">{ev.name}</h1>
      {ev.status !== "drawn" && (
        <div className="alert alert-warning mb-4">
          <span>Traukimas dar nepasibaigė</span>
        </div>
      )}
      {mine?.receiver ? (
        <RevealCard person={mine.receiver} />
      ) : (
        <div className="alert">
          <span>Dar teks palaukti</span>
        </div>
      )}
    </div>
  );
}
