"use client";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { EventCard } from "./EventCard";

type SsEventRow = {
  id: string;
  name: string;
  slug: string;
  type: string | null;
  cover_image_url: string | null;
};
type MemberWithEvent = { id: string; event: SsEventRow };

export default function MyEvents({ user }: { user: User }) {
  const supabase = createClient();
  const { data: events = [], isLoading } = useQuery<MemberWithEvent[]>({
    queryKey: ["my-events", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ss_members")
        .select(
          `
          id,
          event:ss_events!ss_members_event_id_fkey (
            id, name, slug, type, cover_image_url
          )
        `
        )
        .eq("user_id", user.id)
        .returns<MemberWithEvent[]>();
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!events || events.length === 0 || isLoading) return null;
  return (
    <div className="mb-8">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {events.map((e) => (
          <EventCard
            key={e.id}
            title={e.event.name}
            url={`/secret-santa/${e.event.slug}`}
            type={e.event.type}
            coverImageUrl={e.event.cover_image_url}
          />
        ))}
      </div>
    </div>
  );
}
