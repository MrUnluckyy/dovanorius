// app/secret-santa/page.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import EventCard from "./_components/EventCard";
import { qq } from "@/utils/qq";
import { createClient } from "@/utils/supabase/client";
import { SsEvent } from "@/types/secret-santa";

export default function SecretSantaHome() {
  const sb = createClient();
  // app/secret-santa/page.tsx  (replace the queryFn)

  const { data: events, isLoading } = useQuery<SsEvent[]>({
    queryKey: qq.myEvents("me"),
    queryFn: async () => {
      const { data: auth } = await sb.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return [];

      // 1) owned
      const ownedQ = await sb
        .from("ss_events")
        .select("*")
        .eq("owner_id", uid)
        .order("created_at", { ascending: false });
      const owned: SsEvent[] = ownedQ.data ?? [];

      // 2) memberOf -> get event ids
      const memQ = await sb
        .from("ss_members")
        .select("event_id")
        .eq("user_id", uid);
      const memberEventIds = Array.from(
        new Set((memQ.data ?? []).map((r) => r.event_id as string))
      );
      let memberEvents: SsEvent[] = [];
      if (memberEventIds.length) {
        const evQ = await sb
          .from("ss_events")
          .select("*")
          .in("id", memberEventIds);
        memberEvents = evQ.data ?? [];
      }

      // merge de-duped
      const byId = new Map<string, SsEvent>();
      for (const e of [...owned, ...memberEvents]) byId.set(e.id, e);
      return [...byId.values()];
    },
  });

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Secret Santa</h1>
        <Link href="/secret-santa/new" className="btn btn-primary">
          New event
        </Link>
      </div>
      {isLoading && <div className="skeleton h-24 w-full" />}
      <div className="grid gap-3">
        {events?.map((ev) => (
          <EventCard key={ev.id} ev={ev} />
        ))}
        {(!events || events.length === 0) && !isLoading && (
          <div className="alert">
            <span>No events yet. Create your first one.</span>
          </div>
        )}
      </div>
    </div>
  );
}
