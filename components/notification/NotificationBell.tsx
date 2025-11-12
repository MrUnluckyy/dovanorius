"use client";
import { useQuery } from "@tanstack/react-query";

import type { NotificationRow } from "@/types/secret-santa";
import { createClient } from "@/utils/supabase/client";
import {
  acceptInvite,
  declineInvite,
} from "@/app/secret-santa/[slug]/invites/action";
import { LuBell } from "react-icons/lu";

export default function NotificationsBell() {
  const sb = createClient();
  const { data: notifs, refetch } = useQuery<NotificationRow[]>({
    queryKey: ["notifs"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("notifications")
        .select("*")
        .eq("user_id", (await sb.auth.getUser()).data.user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  const pendingInvites = (notifs ?? []).filter((n) => n.type === "ss_invite");

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost">
        <div className="indicator px-1">
          <LuBell className="w-4 h-4" />
          {pendingInvites.length > 0 && (
            <span className="badge badge-xs indicator-item text-xs">
              {pendingInvites.length}
            </span>
          )}
        </div>
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-80"
      >
        {pendingInvites.length === 0 && (
          <li className="opacity-70 p-2">No new notifications</li>
        )}
        {pendingInvites.map((n) => {
          const p = n.payload as {
            event_id: string;
            event_name: string;
            invite_id: string;
            slug: string;
          };
          const accept = async () => {
            await acceptInvite(p.invite_id);
            await refetch();
          };
          const decline = async () => {
            await declineInvite(p.invite_id);
            await refetch();
          };
          return (
            <li key={n.id} className="p-2">
              <div className="flex flex-col gap-2">
                <div>
                  <b>Secret Santa:</b> You are invited to <i>{p.event_name}</i>
                </div>
                <div className="flex gap-2">
                  <a
                    className="btn btn-ghost btn-sm"
                    href={`/secret-santa/${p.slug}`}
                  >
                    Open
                  </a>
                  <button className="btn btn-primary btn-sm" onClick={accept}>
                    Accept
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={decline}>
                    Decline
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
