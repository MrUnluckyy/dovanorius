"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { NotificationRow } from "@/types/secret-santa";
import { createClient } from "@/utils/supabase/client";
import {
  acceptInvite,
  declineInvite,
} from "@/app/secret-santa/[slug]/invites/action";
import { LuBell, LuMegaphone } from "react-icons/lu";
import { markNotificationsRead } from "@/app/notifications/actions";
import Link from "next/link";

type NotificationPayload = {
  event_id: string;
  event_name: string;
  invite_id: string;
  slug: string;
};

type BroadcastPayload = {
  message: string;
  cta_label?: string;
  cta_url?: string;
};

const DISMISSED_KEY = "dismissed_broadcast_notifs";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function addDismissed(id: string) {
  try {
    const set = getDismissed();
    set.add(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {}
}

export default function NotificationsBell() {
  const sb = createClient();
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissed(getDismissed());
  }, []);

  const { data: notifs, refetch } = useQuery<NotificationRow[]>({
    queryKey: ["notifs"],
    queryFn: async () => {
      const userId = (await sb.auth.getUser()).data.user!.id;
      const { data, error } = await sb
        .from("notifications")
        .select("*")
        .or(`user_id.eq.${userId},user_id.is.null`)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  const broadcasts = (notifs ?? []).filter(
    (n) => n.user_id === null && !dismissed.has(n.id)
  );
  const personal = (notifs ?? []).filter(
    (n) => n.user_id !== null && !n.is_read
  );
  const totalCount = broadcasts.length + personal.length;

  const onAccept = async (p: NotificationPayload) => {
    await acceptInvite(p.invite_id!);
    await Promise.all([
      refetch(),
      qc.invalidateQueries({ queryKey: ["ss:members"] }),
      qc.invalidateQueries({ queryKey: ["ss:event"] }),
    ]);
  };

  const onDecline = async (p: NotificationPayload) => {
    await declineInvite(p.invite_id!);
    await Promise.all([
      refetch(),
      qc.invalidateQueries({ queryKey: ["ss:members"] }),
      qc.invalidateQueries({ queryKey: ["ss:event"] }),
    ]);
  };

  const onDismiss = async (id: string) => {
    await markNotificationsRead([id]);
    refetch();
  };

  const onDismissBroadcast = (id: string) => {
    addDismissed(id);
    setDismissed(new Set([...dismissed, id]));
  };

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost">
        <div className="indicator px-1">
          <LuBell className="w-4 h-4" />
          {totalCount > 0 && (
            <span className="badge badge-xs indicator-item text-xs">
              {totalCount}
            </span>
          )}
        </div>
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box min-w-80"
      >
        {totalCount === 0 && (
          <li className="opacity-70 p-2">Pranešimų nėra</li>
        )}

        {/* Broadcast notifications */}
        {broadcasts.map((n) => {
          const p = n.payload as BroadcastPayload;
          return (
            <li key={n.id} className="p-2 w-full">
              <div className="flex flex-col gap-3 w-full">
                <div className="flex gap-2 items-start">
                  <LuMegaphone size={15} className="shrink-0 mt-0.5 text-primary" />
                  <p className="text-sm leading-snug">{p.message}</p>
                </div>
                <div className="flex justify-end gap-2">
                  {p.cta_url && p.cta_label && (
                    <Link
                      href={p.cta_url}
                      className="btn btn-primary btn-xs"
                      target={p.cta_url.startsWith("http") ? "_blank" : undefined}
                      rel={p.cta_url.startsWith("http") ? "noopener noreferrer" : undefined}
                    >
                      {p.cta_label}
                    </Link>
                  )}
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => onDismissBroadcast(n.id)}
                  >
                    Uždaryti
                  </button>
                </div>
              </div>
            </li>
          );
        })}

        {/* Personal notifications */}
        {personal.map((n) => {
          const p = n.payload as NotificationPayload;
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
