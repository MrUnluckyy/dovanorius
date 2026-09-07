"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { User } from "@supabase/supabase-js";
import toast from "react-hot-toast";
import { LuUserPlus } from "react-icons/lu";
import type {
  Participant,
  SsEvent,
  SsMember,
} from "@/types/secret-santa";
import { createClient } from "@/utils/supabase/client";
import { qq } from "@/utils/qq";
import { getEventTypeMeta } from "@/utils/events/typeMeta";
import { setEventStatus } from "@/app/actions/events/manage";
import LobbyHeader from "./LobbyHeader";
import Participants from "./Participants";
import DrawButton from "./DrawButton";
import RevealCard from "./RevealCard";
import AdminsSettings from "./AdminsSettings";
import InvitePeopleSheet from "./InvitePeopleSheet";
import EventSettingsSheet from "./EventSettingsSheet";
import SecureSeatNotice from "./SecureSeatNotice";
import { Snowfall } from "../../_components/Snowfall";

export default function LobbyClient({
  slug,
  user,
}: {
  slug: string;
  user: User;
}) {
  const sb = createClient();
  const qc = useQueryClient();
  const t = useTranslations("Events");
  const searchParams = useSearchParams();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // A freshly created event arrives with ?invite=1 so the organiser's next
  // step — getting people in — is already on screen.
  useEffect(() => {
    if (searchParams.get("invite") === "1") setInviteOpen(true);
  }, [searchParams]);

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
    queryKey: qq.members(event?.id ?? "none"),
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
    queryKey: qq.participants(event?.id ?? "none"),
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

  const { data: mine } = useQuery({
    enabled: !!event?.id,
    queryKey: qq.myAssignment(event?.id ?? "none", user.id),
    queryFn: async () => {
      const { data } = await sb
        .from("ss_my_assignment")
        .select("*")
        .eq("event_id", event!.id)
        .maybeSingle();
      if (!data) return null;
      const { data: profile } = await sb
        .from("profiles")
        .select("id,display_name,avatar_url")
        .eq("id", data.receiver)
        .single();
      return { receiver: profile };
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (next: "open" | "locked") => {
      const res = await setEventStatus(slug, next);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qq.event(slug) }),
    onError: () => toast.error(t("lockFailed")),
  });

  const isOwner = event?.owner_id === user.id;
  const isAdmin =
    isOwner ||
    (members ?? []).some(
      (m) => m.user_id === user.id && (m.role === "owner" || m.role === "admin")
    );

  const meta = getEventTypeMeta(event?.type);
  const joinedCount = (participants ?? []).filter(
    (p) => p.status === "joined"
  ).length;
  const notEnoughMembers = joinedCount < meta.minMembers;
  const isGroup = meta.type === "group";

  if (isLoading || !event) {
    return (
      <div className="mx-auto w-full max-w-[720px] space-y-4 px-4 py-8">
        <div className="nr-skeleton h-[220px] w-full rounded-[24px]" />
        <div className="nr-skeleton h-[120px] w-full rounded-[24px]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-6 pb-20 md:py-10">
      <LobbyHeader
        ev={event}
        joinedCount={joinedCount}
        canManage={isAdmin || !isOwner}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* A guest's seat only exists in this browser until they confirm an
          address, so the offer to fix that sits above everything else. */}
      {user.is_anonymous && (
        <section className="mt-4">
          <SecureSeatNotice knownEmail={user.email ?? null} />
        </section>
      )}

      {/* One clear next step, chosen by where the event actually is. */}
      <section className="mt-4">
        {isGroup ? (
          <p className="nr-card px-5 py-4 text-[15px] text-(--nr-muted)">
            {t("groupManageInApp")}
          </p>
        ) : event.status === "drawn" ? (
          mine?.receiver ? (
            <RevealCard person={mine.receiver} type={meta.type} />
          ) : (
            <p className="nr-card px-5 py-4 text-[15px] text-(--nr-muted)">
              {t("drawnNoAssignment")}
            </p>
          )
        ) : isAdmin ? (
          <div className="nr-card p-5">
            <p className="mb-4 text-[15px] leading-relaxed text-(--nr-muted)">
              {notEnoughMembers
                ? t("needMoreToDraw", {
                    count: Math.max(meta.minMembers - joinedCount, 0),
                  })
                : t("readyToDraw", { count: joinedCount })}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setInviteOpen(true)}
                className="nr-btn nr-btn-primary flex-1"
              >
                <LuUserPlus className="w-4" />
                {t("inviteMembers")}
              </button>
              <DrawButton
                slug={slug}
                eventId={event.id}
                disabled={notEnoughMembers || event.status === "archived"}
              />
            </div>
            {event.status === "locked" && (
              <button
                onClick={() => lockMutation.mutate("open")}
                disabled={lockMutation.isPending}
                className="mt-3 text-[14px] font-semibold text-(--nr-gold-strong) underline underline-offset-2 disabled:opacity-50"
              >
                {t("reopenEvent")}
              </button>
            )}
          </div>
        ) : (
          <p className="nr-card px-5 py-4 text-[15px] text-(--nr-muted)">
            {t("drawWaiting")}
          </p>
        )}
      </section>

      <section className="mt-4">
        <Participants
          event={event}
          participants={participants ?? []}
          isAdmin={isAdmin}
          currentUserId={user.id}
          selectedUserId={selectedUserId}
          onUserSelect={setSelectedUserId}
          onInvite={() => setInviteOpen(true)}
        />
      </section>

      {event.notes && (
        <section className="nr-card mt-4 p-5">
          <h2 className="nr-h3 mb-3 text-[16px]">{t("detailsTitle")}</h2>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-(--nr-ink-2)">
            {event.notes}
          </p>
        </section>
      )}

      {/* Exclusions are an organiser's tool and only make sense before a draw. */}
      {!isGroup && isAdmin && event.status !== "drawn" && selectedUserId && (
        <section className="mt-4">
          <AdminsSettings
            eventId={event.id}
            giverId={selectedUserId}
            participants={participants ?? []}
          />
        </section>
      )}

      <InvitePeopleSheet
        slug={slug}
        eventId={event.id}
        joinToken={event.join_token}
        participants={participants ?? []}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />

      <EventSettingsSheet
        event={event}
        isOwner={isOwner}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {meta.theme === "christmas" && <Snowfall />}
    </div>
  );
}
