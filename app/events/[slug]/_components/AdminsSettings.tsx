"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { updateExclusions } from "../exclusions/action";

type Participant = {
  event_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: "owner" | "admin" | "member";
  status: "joined" | "accepted" | "pending" | "declined";
};

type ExclusionRow = { b: string };

interface ExclusionsCardProps {
  eventId: string;
  giverId: string;
}

export default function AdminsSettings({
  eventId,
  giverId,
}: ExclusionsCardProps) {
  const sb = createClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // participants for this event
  const participantsQuery = useQuery<Participant[]>({
    queryKey: ["ss:participants", eventId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("ss_participants")
        .select("event_id,user_id,display_name,avatar_url,role,status")
        .eq("event_id", eventId)
        .returns<Participant[]>();
      if (error) throw error;
      return data ?? [];
    },
  });

  // current exclusions for this giver
  const exclusionsQuery = useQuery<string[]>({
    queryKey: ["ss:exclusions", eventId, giverId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("ss_exclusions")
        .select("b")
        .eq("event_id", eventId)
        .eq("a", giverId)
        .returns<ExclusionRow[]>();
      if (error) throw error;
      return (data ?? []).map((r) => r.b);
    },
  });

  // sync local state when exclusions are loaded
  useEffect(() => {
    if (!exclusionsQuery.data) return;
    setSelected(new Set(exclusionsQuery.data));
  }, [exclusionsQuery.data]);

  const mutation = useMutation({
    mutationFn: async (blockedIds: string[]) => {
      await updateExclusions(eventId, giverId, blockedIds);
    },
  });

  if (participantsQuery.isLoading || exclusionsQuery.isLoading) {
    return (
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <div className="skeleton h-6 w-40 mb-3" />
          <div className="skeleton h-10 w-full" />
        </div>
      </div>
    );
  }

  const participants = (participantsQuery.data ?? []).filter(
    (p) => p.user_id !== giverId
  );

  const giver = (participantsQuery.data ?? []).find(
    (p) => p.user_id === giverId
  );

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSave = () => {
    const blockedIds = Array.from(selected);
    mutation.mutate(blockedIds);
  };

  const titleName = giver?.display_name ?? "Dalyvis";

  return (
    <div className="card bg-base-200 shadow-lg">
      <div className="card-body gap-4">
        <h2 className="card-title">Traukimo apribojimai - {titleName}</h2>
        <p className="text-sm opacity-70">
          Pažymėk dalyvius, kurių {titleName} negali ištraukti šiais metais.
        </p>

        <div className="max-h-64 overflow-auto rounded-xl border border-base-200">
          <ul className="menu bg-base-300 w-full">
            {participants.map((p) => (
              <li key={p.user_id}>
                <label className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-base-200">
                  <div className="avatar">
                    <div className="w-8 h-8 rounded-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.avatar_url ?? "/avatar.png"}
                        alt={p.display_name}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">{p.display_name}</span>
                    <span className="text-xs opacity-60">
                      {p.status === "joined"
                        ? "Prisijungęs"
                        : p.status === "accepted"
                        ? "Priėmė kvietimą"
                        : p.status === "pending"
                        ? "Pakviestas"
                        : "Atmetė"}
                    </span>
                  </div>
                  <span className="ml-auto">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={selected.has(p.user_id)}
                      onChange={() => toggle(p.user_id)}
                    />
                  </span>
                </label>
              </li>
            ))}
            {participants.length === 0 && (
              <li className="px-4 py-2 text-sm opacity-70">
                Nėra kitų dalyvių, kuriuos galima būtų apriboti.
              </li>
            )}
          </ul>
        </div>

        <div className="card-actions justify-end">
          <button
            type="button"
            className={`btn btn-primary ${mutation.isPending ? "loading" : ""}`}
            onClick={handleSave}
            disabled={mutation.isPending}
          >
            Išsaugoti apribojimus
          </button>
        </div>
      </div>
    </div>
  );
}
