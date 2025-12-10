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
import EventSettings from "./EventSettings";
import { ProgressOfEvent } from "./ProgressOfEvent";
import { LuInfo } from "react-icons/lu";
import RevealCard from "./RevealCard";
import AdminsSettings from "./AdminsSettings";

export default function LobbyClient({
  slug,
  user,
}: {
  slug: string;
  user: User;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
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
      setSelectedUserId(data[0].user_id ?? null);
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

  const { data: mine } = useQuery({
    enabled: !!event?.id,
    queryKey: qq.myAssignment(event?.id ?? "x", "me"),
    queryFn: async () => {
      const { data } = await sb
        .from("ss_my_assignment")
        .select("*")
        .eq("event_id", event!.id)
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

  const isAdmin =
    (members &&
      members.some(
        (m) =>
          m.user_id === user.id && (m.role === "owner" || m.role === "admin")
      )) ||
    event?.owner_id === user.id;

  return (
    <div className="max-w-3xl mx-auto p-4 pb-16 space-y-6">
      {isLoading && <div className="skeleton h-24 w-full" />}

      {event && (
        <>
          <LobbyHeader ev={event} />

          <ProgressOfEvent event={event} />
          {event.status === "drawn" && mine?.receiver ? (
            <div className="w-full justify-center items-center">
              <RevealCard person={mine?.receiver} />
            </div>
          ) : null}

          {members && members.length < 3 && (
            <div role="alert" className="alert alert-info">
              <LuInfo className="w-6 h-6" />
              <span>Minimalus dalyviu skaičius yra 3</span>
            </div>
          )}

          {isAdmin && (
            <>
              <div className="flex flex-col md:flex-row items-center gap-2">
                <button
                  className="btn btn-primary w-full md:w-auto"
                  onClick={() => lockMutation.mutate()}
                  disabled={
                    event.status !== "open" ||
                    lockMutation.isPending ||
                    (members && members.length < 3)
                  }
                >
                  {lockMutation.isPending ? "Uždaroma..." : "Uždaryti"}
                </button>
                {
                  <button
                    className="btn btn-primary  w-full md:w-auto"
                    disabled={event.status !== "open"}
                    onClick={() => setInviteOpen(true)}
                  >
                    Pakviesti dalyvių
                  </button>
                }
                <DrawButton
                  slug={slug}
                  disabled={
                    !["locked", "open"].includes(event.status) ||
                    (members && members.length < 3)
                  }
                />
              </div>
              <InviteFollowersModal
                slug={slug}
                open={inviteOpen}
                onClose={() => setInviteOpen(false)}
              />
            </>
          )}
          <div className="flex flex-col gap-6 md:flex-row">
            <EventSettings event={event} />
            <Participants
              event={event}
              participants={participants ?? []}
              onUserSelect={(id: string) => setSelectedUserId(id)}
              isAdmin={isAdmin}
            />
          </div>
          {event.status !== "drawn" && isAdmin && selectedUserId && (
            <AdminsSettings eventId={event.id} giverId={selectedUserId} />
          )}
        </>
      )}
    </div>
  );
}
