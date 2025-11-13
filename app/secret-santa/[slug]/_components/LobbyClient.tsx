"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import LobbyHeader from "../_components/LobbyHeader";
import Participants from "../_components/Participants";
import DrawButton from "../_components/DrawButton";
import type {
  Participant,
  SsEvent,
  SsInvite,
  SsMember,
} from "@/types/secret-santa";
import { createClient } from "@/utils/supabase/client";
import { qq } from "@/utils/qq";
import { useState } from "react";
import InviteFollowersModal from "./InviteFollowersModal";
import { User } from "@supabase/supabase-js";

export default function LobbyClient({
  slug,
  user,
}: {
  slug: string;
  user: User;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
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

  const { data: invites } = useQuery<SsInvite[]>({
    enabled: !!event?.id,
    queryKey: event?.id ? qq.invites(event.id) : ["noop"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("ss_invites")
        .select("*, to_user:profiles(*)")
        .eq("event_id", event!.id);
      if (error) throw error;
      return (data as unknown as SsInvite[]) ?? [];
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

  const { data: participants } = useQuery<Participant[]>({
    enabled: !!event?.id,
    queryKey: event?.id ? qq.participants(event.id) : ["noop"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("ss_participants")
        .select(
          "event_id, user_id, display_name, avatar_url, role, status, joined_at"
        )
        .eq("event_id", event!.id);
      if (error) throw error;
      return (data as unknown as Participant[]) ?? [];
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const uid = user?.id;
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
    <div className="max-w-3xl mx-auto p-4 pb-16 space-y-6">
      {isLoading && <div className="skeleton h-24 w-full" />}
      {event && (
        <>
          <LobbyHeader ev={event} />
          {members &&
            (members.some(
              (m) =>
                m.user_id === user.id &&
                (m.role === "owner" || m.role === "admin")
            ) ||
              event.owner_id === user.id) && (
              <>
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-outline"
                    onClick={() => lockMutation.mutate()}
                    disabled={event.status !== "open" || lockMutation.isPending}
                  >
                    {lockMutation.isPending ? "Locking..." : "Lock joining"}
                  </button>
                  <button className="btn" onClick={() => setInviteOpen(true)}>
                    Invite followers
                  </button>
                  <DrawButton
                    slug={slug}
                    disabled={!["locked", "open"].includes(event.status)}
                  />
                </div>
                <InviteFollowersModal
                  slug={slug}
                  open={inviteOpen}
                  onClose={() => setInviteOpen(false)}
                />
              </>
            )}
          <Participants event={event} participants={participants ?? []} />
        </>
      )}
    </div>
  );
}
