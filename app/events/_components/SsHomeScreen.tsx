"use client";

import { SsEvent } from "@/types/secret-santa";
import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LuPlus } from "react-icons/lu";
import EventCard from "./EventCard";
import InvitationsInbox from "./InvitationsInbox";
import { qq } from "@/utils/qq";

type EventWithCount = SsEvent & { member_count: number };

export default function SsHomeScreen({ userId }: { userId: string }) {
  const sb = createClient();
  const t = useTranslations("Events");

  const { data: events, isLoading } = useQuery<EventWithCount[]>({
    queryKey: qq.myEvents(userId),
    queryFn: async () => {
      // Owned and joined events are the same list to the person reading it.
      // Two queries rather than an `or` because ss_events and ss_members are
      // different tables; RLS keeps both honest.
      const [ownedQ, memQ] = await Promise.all([
        sb
          .from("ss_events")
          .select("*, ss_members(count)")
          .eq("owner_id", userId),
        sb.from("ss_members").select("event_id").eq("user_id", userId),
      ]);

      const owned = (ownedQ.data ?? []) as unknown as EventWithCount[];
      const memberEventIds = Array.from(
        new Set((memQ.data ?? []).map((r) => r.event_id as string))
      );

      let joined: EventWithCount[] = [];
      if (memberEventIds.length) {
        const { data } = await sb
          .from("ss_events")
          .select("*, ss_members(count)")
          .in("id", memberEventIds);
        joined = (data ?? []) as unknown as EventWithCount[];
      }

      const byId = new Map<string, EventWithCount>();
      for (const e of [...owned, ...joined]) {
        byId.set(e.id, {
          ...e,
          member_count:
            (e as unknown as { ss_members?: { count: number }[] }).ss_members?.[0]
              ?.count ?? 0,
        });
      }

      // Soonest first, undated last — the one happening next is the one you
      // opened this page to find.
      return [...byId.values()].sort((a, b) => {
        if (a.event_date && b.event_date)
          return a.event_date.localeCompare(b.event_date);
        if (a.event_date) return -1;
        if (b.event_date) return 1;
        return b.created_at.localeCompare(a.created_at);
      });
    },
  });

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-8 md:py-12">
      <header className="mb-7 flex items-end justify-between gap-4">
        <div>
          <h1 className="nr-h2 text-[30px] md:text-[34px]">{t("title")}</h1>
          <p className="mt-1 text-[15px] text-(--nr-muted)">{t("subtitle")}</p>
        </div>
        <Link
          href="/events/new"
          className="nr-btn nr-btn-primary nr-btn-sm shrink-0"
        >
          <LuPlus className="w-4" />
          <span className="hidden sm:inline">{t("newEvent")}</span>
        </Link>
      </header>

      <InvitationsInbox userId={userId} />

      {isLoading ? (
        <div className="space-y-3">
          <div className="nr-skeleton h-[92px] w-full rounded-[24px]" />
          <div className="nr-skeleton h-[92px] w-full rounded-[24px]" />
        </div>
      ) : events && events.length > 0 ? (
        <div className="grid gap-3">
          {events.map((ev) => (
            <EventCard key={ev.id} ev={ev} memberCount={ev.member_count} />
          ))}
        </div>
      ) : (
        <div className="nr-card px-6 py-12 text-center">
          <span className="mb-4 inline-grid h-14 w-14 place-items-center rounded-full bg-(--nr-tile) text-2xl">
            🎁
          </span>
          <h2 className="nr-h3 mb-2 text-[20px]">{t("emptyTitle")}</h2>
          <p className="nr-lead mx-auto mb-6 max-w-[34ch] text-[15px]">
            {t("emptyBody")}
          </p>
          <Link href="/events/new" className="nr-btn nr-btn-primary">
            {t("newEvent")}
          </Link>
        </div>
      )}
    </div>
  );
}
