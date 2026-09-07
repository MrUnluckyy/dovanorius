"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { createClient } from "@/utils/supabase/client";
import { acceptInvite, declineInvite } from "../[slug]/invites/action";
import { getEventTypeMeta } from "@/utils/events/typeMeta";
import { qq } from "@/utils/qq";
import type { SsEventType } from "@/types/secret-santa";

type PendingInvite = {
  id: string;
  event: {
    id: string;
    name: string;
    slug: string;
    type: SsEventType;
    event_date: string | null;
  } | null;
  from_profile: { display_name: string | null } | null;
};

/**
 * Invitations waiting for an answer, on the page where you look for your events.
 *
 * They used to exist only inside the notification bell, which shows the twenty
 * most recent notifications and forgets anything dismissed — so an invitation
 * that scrolled past, or that you closed by accident, became unreachable and
 * the event stayed invisible to you forever.
 */
export default function InvitationsInbox({ userId }: { userId: string }) {
  const sb = createClient();
  const qc = useQueryClient();
  const t = useTranslations("Events");

  const { data: invites = [] } = useQuery<PendingInvite[]>({
    queryKey: qq.myInvites(userId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("ss_invites")
        .select(
          `id,
           event:ss_events!ss_invites_event_id_fkey ( id, name, slug, type, event_date ),
           from_profile:profiles!ss_invites_from_user_fkey ( display_name )`
        )
        .eq("to_user", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PendingInvite[];
    },
  });

  const settle = useMutation({
    mutationFn: async ({
      id,
      accept,
    }: {
      id: string;
      accept: boolean;
    }): Promise<string | null> => {
      if (accept) {
        const res = await acceptInvite(id);
        return res.slug;
      }
      await declineInvite(id);
      return null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qq.myInvites(userId) });
      qc.invalidateQueries({ queryKey: qq.myEventsAll() });
    },
    onError: () => toast.error(t("inviteAnswerFailed")),
  });

  if (invites.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="nr-overline mb-3 text-(--nr-gold-strong)">
        {t("invitationsTitle")}
      </h2>
      <ul className="space-y-2">
        {invites.map((inv) => {
          if (!inv.event) return null;
          const meta = getEventTypeMeta(inv.event.type);
          return (
            <li
              key={inv.id}
              className="nr-card flex flex-wrap items-center gap-3 p-4"
            >
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-(--nr-tile) text-xl"
                aria-hidden
              >
                {meta.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-[16px] font-bold text-(--nr-ink)">
                  {inv.event.name}
                </p>
                <p className="truncate text-[13px] text-(--nr-muted)">
                  {inv.from_profile?.display_name
                    ? t("invitedByLine", {
                        name: inv.from_profile.display_name,
                      })
                    : t(meta.labelKey)}
                </p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <button
                  onClick={() =>
                    settle.mutate(
                      { id: inv.id, accept: true },
                      {
                        onSuccess: (slug) => {
                          if (slug) window.location.assign(`/events/${slug}`);
                        },
                      }
                    )
                  }
                  disabled={settle.isPending}
                  className="nr-btn nr-btn-primary nr-btn-sm flex-1 disabled:opacity-50 sm:flex-none"
                >
                  {t("inviteAccept")}
                </button>
                <button
                  onClick={() => settle.mutate({ id: inv.id, accept: false })}
                  disabled={settle.isPending}
                  className="nr-btn nr-btn-outline nr-btn-sm flex-1 disabled:opacity-50 sm:flex-none"
                >
                  {t("inviteDecline")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
