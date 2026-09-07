"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { Avatar } from "@/components/Avatar";
import { createClient } from "@/utils/supabase/client";
import { qq } from "@/utils/qq";
import type { Participant } from "@/types/secret-santa";
import { updateExclusions } from "../exclusions/action";

type ExclusionRow = { b: string };

/**
 * Who a given person must not draw — couples, siblings, whoever had each other
 * last year.
 *
 * Participants arrive as a prop rather than being fetched again: this used to
 * run its own query under a hand-written key that shadowed the lobby's, so the
 * two lists could disagree and neither invalidated the other.
 */
export default function AdminsSettings({
  eventId,
  giverId,
  participants,
}: {
  eventId: string;
  giverId: string;
  participants: Participant[];
}) {
  const sb = createClient();
  const t = useTranslations("Events");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: saved, isLoading } = useQuery<string[]>({
    queryKey: qq.exclusions(eventId, giverId),
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

  useEffect(() => {
    if (saved) setSelected(new Set(saved));
  }, [saved]);

  const mutation = useMutation({
    mutationFn: (blockedIds: string[]) =>
      updateExclusions(eventId, giverId, blockedIds),
    onSuccess: () => toast.success(t("exclusionsSaved")),
    onError: () => toast.error(t("exclusionsSaveFailed")),
  });

  const giver = participants.find((p) => p.user_id === giverId);
  const others = participants.filter((p) => p.user_id !== giverId);
  const giverName = giver?.display_name || t("invitePersonUnnamed");

  const toggle = (userId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  if (isLoading) {
    return <div className="nr-skeleton h-40 w-full rounded-[24px]" />;
  }

  return (
    <div className="nr-card p-5">
      <h2 className="nr-h3 text-[16px]">
        {t("exclusionsTitle", { name: giverName })}
      </h2>
      <p className="mt-1 text-[14px] leading-relaxed text-(--nr-muted)">
        {t("exclusionsBody", { name: giverName })}
      </p>

      {others.length === 0 ? (
        <p className="mt-4 text-[14px] text-(--nr-faint)">
          {t("exclusionsNobody")}
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-1">
            {others.map((p) => {
              const on = selected.has(p.user_id);
              return (
                <li key={p.user_id}>
                  <button
                    onClick={() => toggle(p.user_id)}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-(--nr-tile)/50"
                  >
                    <Avatar
                      avatar_url={p.avatar_url}
                      name={p.display_name || "?"}
                      size={8}
                    />
                    <span className="min-w-0 flex-1 truncate text-[15px] text-(--nr-ink)">
                      {p.display_name || t("invitePersonUnnamed")}
                    </span>
                    <input
                      type="checkbox"
                      readOnly
                      checked={on}
                      className="checkbox checkbox-sm pointer-events-none"
                    />
                  </button>
                </li>
              );
            })}
          </ul>

          <button
            onClick={() => mutation.mutate(Array.from(selected))}
            disabled={mutation.isPending}
            className="nr-btn nr-btn-outline nr-btn-sm mt-4 w-full disabled:opacity-50"
          >
            {mutation.isPending ? t("savingEvent") : t("exclusionsSave")}
          </button>
        </>
      )}
    </div>
  );
}
