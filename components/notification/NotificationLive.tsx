// components/NotificationsLive.tsx
"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

export default function NotificationsLive() {
  const sb = createClient();
  const qc = useQueryClient();

  useEffect(() => {
    let sub: ReturnType<typeof sb.channel> | null = null;
    (async () => {
      const { data: auth } = await sb.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;

      sub = sb
        .channel(`notifs-${uid}`)
        .on(
          "postgres_changes",
          {
            schema: "public",
            table: "notifications",
            event: "INSERT",
            filter: `user_id=eq.${uid}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: ["notifs"] });
          }
        )
        .subscribe();
    })();

    return () => {
      sub?.unsubscribe();
    };
  }, [sb, qc]);

  return null;
}
