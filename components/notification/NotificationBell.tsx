"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { NotificationRow } from "@/types/secret-santa";
import { createClient } from "@/utils/supabase/client";
import {
  acceptInvite,
  declineInvite,
} from "@/app/secret-santa/[slug]/invites/action";
import { LuBell } from "react-icons/lu";
import { markNotificationsRead } from "@/app/notifications/actions";
import Link from "next/link";

type NotificationPayload = {
  event_id: string;
  event_name: string;
  invite_id: string;
  slug: string;
};

export default function NotificationsBell() {
  const sb = createClient();
  const qc = useQueryClient();
  const { data: notifs, refetch } = useQuery<NotificationRow[]>({
    queryKey: ["notifs"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("notifications")
        .select("*")
        .eq("user_id", (await sb.auth.getUser()).data.user!.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  console.log("NotificationsBell notifs:", notifs);

  const pendingInvites = (notifs ?? []).filter((n) => n.is_read === false);

  const onAccept = async (p: NotificationPayload) => {
    await acceptInvite(p.invite_id!); // marks invite notif read + inserts joined notif
    await Promise.all([
      refetch(),
      qc.invalidateQueries({ queryKey: ["ss:members"] }),
      qc.invalidateQueries({ queryKey: ["ss:event"] }),
    ]);
  };
  const onDecline = async (p: NotificationPayload) => {
    await declineInvite(p.invite_id!); // marks invite notif read
    await Promise.all([
      refetch(),
      qc.invalidateQueries({ queryKey: ["ss:members"] }),
      qc.invalidateQueries({ queryKey: ["ss:event"] }),
    ]);
  };

  const onDismiss = async (id: string) => {
    await markNotificationsRead([id]);
    await Promise.all([refetch()]);
  };

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
        className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box min-w-80"
      >
        {pendingInvites.length === 0 && (
          <li className="opacity-70 p-2">Pranešimų nėra</li>
        )}
        {pendingInvites.map((n) => {
          const p = n.payload as {
            event_id: string;
            event_name: string;
            invite_id: string;
            slug: string;
          };
          return (
            <li key={n.id} className="p-2 w-full">
              <div className="flex flex-col gap-4 w-full">
                {n.type === "ss_invite" && (
                  <>
                    <div>
                      <b>🎅 Secret Santa:</b> Gavai pakvietimą į{" "}
                      <i>{p.event_name}</i>
                    </div>
                    <div className="flex justify-end gap-2 w-full">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => onAccept(p)}
                      >
                        Priimti
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => onDecline(p)}
                      >
                        Atšaukti
                      </button>
                    </div>
                  </>
                )}
                {n.type === "ss_joined" && (
                  <>
                    <div>
                      <b>🎅 Secret Santa</b> Prisijungiai prie{" "}
                      <i>{p.event_name}</i>
                    </div>
                    <div className="flex justify-end gap-2 w-full">
                      <Link
                        href={`/secret-santa/${p.slug}`}
                        className="btn btn-primary btn-sm"
                      >
                        Atidaryti
                      </Link>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => onDismiss(n.id)}
                      >
                        Užmiršti
                      </button>
                    </div>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
