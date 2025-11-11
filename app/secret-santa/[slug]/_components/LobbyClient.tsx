"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import LobbyHeader from "../_components/LobbyHeader";
import Participants from "../_components/Participants";
import DrawButton from "../_components/DrawButton";
import type { SsEvent, SsMember } from "@/types/secret-santa";
import { createClient } from "@/utils/supabase/client";
import { qq } from "@/utils/qq";

export default function LobbyClient({ slug }: { slug: string }) {
  const sb = createClient();
  const qc = useQueryClient();

  const { data: event, isLoading } = useQuery<SsEvent>({
    queryKey: qq.event(slug),
    queryFn: async () => {
      const { data, error } = await sb
        .from("ss_events")
        .select("*")
        .eq("slug", slug)
        .single<SsEvent>();
      if (error || !data) throw error ?? new Error("Event not found");
      return data;
    },
  });

  const { data: members } = useQuery<SsMember[]>({
    enabled: !!event?.id,
    queryKey: event?.id ? qq.members(event.id) : ["noop"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("ss_members")
        .select("*, profile:profiles(*)")
        .eq("event_id", event!.id);
      if (error) throw error;
      return (data as unknown as SsMember[]) ?? [];
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const { data: auth } = await sb.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || !event) throw new Error("Not allowed");
      const amAdmin =
        event.owner_id === uid ||
        (members ?? []).some(
          (m) => m.user_id === uid && (m.role === "owner" || m.role === "admin")
        );
      if (!amAdmin) throw new Error("Not allowed");
      const { error } = await sb
        .from("ss_events")
        .update({ status: "locked" as const })
        .eq("id", event.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qq.event(slug) }),
  });

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      {isLoading && <div className="skeleton h-24 w-full" />}
      {event && (
        <>
          <LobbyHeader ev={event} />
          <div className="flex items-center gap-2">
            <button
              className="btn btn-outline"
              onClick={() => lockMutation.mutate()}
              disabled={event.status !== "open" || lockMutation.isPending}
            >
              {lockMutation.isPending ? "Locking..." : "Lock joining"}
            </button>
            <DrawButton
              slug={slug}
              disabled={!["locked", "open"].includes(event.status)}
            />
          </div>
          <Participants event={event} members={members ?? []} />
        </>
      )}
    </div>
  );
}
