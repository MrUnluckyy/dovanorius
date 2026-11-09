"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { qq } from "@/utils/qq";

const HIGHLIGHT_MS = 4000;

/**
 * Keep an open lobby current: somebody joins, is invited, answers an
 * invitation, or the organiser draws, and every open lobby shows it without a
 * reload. Same subscription as noriuto-app's event screen (ss_members,
 * ss_events and ss_invites are in the supabase_realtime publication).
 *
 * Realtime applies the tables' RLS, so a subscriber only hears about events
 * they can read. Payloads are only a signal: everything is refetched through
 * the normal queries. Postgres-changes cannot filter DELETEs, so removals
 * arrive on the next refetch (window focus) rather than live.
 *
 * Returns the people who joined in the last few seconds, for a highlight.
 */
export function useEventLive({
  eventId,
  slug,
  userId,
}: {
  eventId: string | undefined;
  slug: string;
  userId: string;
}) {
  const qc = useQueryClient();
  const [justJoined, setJustJoined] = useState<Set<string>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!eventId) return;
    const sb = createClient();

    const roster = () => {
      qc.invalidateQueries({ queryKey: qq.participants(eventId) });
      qc.invalidateQueries({ queryKey: qq.members(eventId) });
      qc.invalidateQueries({ queryKey: ["ss:managed", eventId] });
    };

    const channel = sb
      .channel(`event-lobby-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ss_members", filter: `event_id=eq.${eventId}` },
        (payload) => {
          roster();
          const joined =
            payload.eventType === "INSERT"
              ? ((payload.new as { user_id?: string })?.user_id ?? null)
              : null;
          if (joined && joined !== userId) {
            setJustJoined((prev) => new Set(prev).add(joined));
            timers.current.push(
              setTimeout(() => {
                setJustJoined((prev) => {
                  const next = new Set(prev);
                  next.delete(joined);
                  return next;
                });
              }, HIGHLIGHT_MS)
            );
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ss_invites", filter: `event_id=eq.${eventId}` },
        () => {
          roster();
          qc.invalidateQueries({ queryKey: qq.invites(eventId) });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ss_events", filter: `id=eq.${eventId}` },
        () => {
          // Details, lock/reopen, and above all the draw: everyone's result
          // appears the moment the organiser draws.
          qc.invalidateQueries({ queryKey: qq.event(slug) });
          qc.invalidateQueries({ queryKey: qq.myAssignment(eventId, userId) });
          qc.invalidateQueries({ queryKey: ["ss:managedAssignment", eventId] });
          qc.invalidateQueries({ queryKey: ["ss:revealedCount", eventId] });
        }
      )
      .subscribe();

    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      timers.current = [];
      sb.removeChannel(channel);
    };
  }, [eventId, slug, userId, qc]);

  return justJoined;
}
