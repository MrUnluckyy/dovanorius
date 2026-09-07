"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { LuCheck, LuClock, LuCrown, LuUserMinus, LuUserPlus, LuX } from "react-icons/lu";
import { Avatar } from "@/components/Avatar";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { removeMember } from "@/app/actions/events/manage";
import { qq } from "@/utils/qq";
import type { Participant, SsEvent } from "@/types/secret-santa";

const STATUS_STYLE: Record<Participant["status"], string> = {
  joined: "bg-(--nr-success-soft) text-(--nr-success-ink)",
  accepted: "bg-(--nr-success-soft) text-(--nr-success-ink)",
  pending: "bg-(--nr-warning-soft) text-(--nr-warning-ink)",
  declined: "bg-(--nr-error-soft) text-(--nr-error-ink)",
};

export default function Participants({
  event,
  participants,
  isAdmin,
  currentUserId,
  onInvite,
}: {
  event: SsEvent;
  participants: Participant[];
  isAdmin: boolean;
  currentUserId: string;
  onInvite: () => void;
}) {
  const t = useTranslations("Events");
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);

  const drawn = event.status === "drawn";

  const remove = async (p: Participant) => {
    const ok = await confirm({
      title: t("removeConfirmTitle"),
      message: t("removeConfirmBody", { name: p.display_name || "" }),
      confirmText: t("removeConfirmCta"),
    });
    if (!ok) return;

    setBusyId(p.user_id);
    const res = await removeMember(event.slug, p.user_id);
    setBusyId(null);
    if (!res.ok) {
      toast.error(
        res.error === "already_drawn"
          ? t("removeAfterDraw")
          : t("removeFailed")
      );
      return;
    }
    qc.invalidateQueries({ queryKey: qq.participants(event.id) });
    qc.invalidateQueries({ queryKey: qq.members(event.id) });
  };

  return (
    <div className="nr-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="nr-h3 text-[16px]">
          {t("participants", { count: participants.length })}
        </h2>
        {isAdmin && !drawn && (
          <button
            onClick={onInvite}
            className="flex items-center gap-1.5 text-[14px] font-semibold text-(--nr-gold-strong)"
          >
            <LuUserPlus className="w-4" />
            {t("inviteShort")}
          </button>
        )}
      </div>

      {participants.length === 0 ? (
        <div className="rounded-[16px] bg-(--nr-cream) px-4 py-8 text-center">
          <p className="text-[15px] text-(--nr-muted)">{t("noParticipants")}</p>
          {isAdmin && (
            <button
              onClick={onInvite}
              className="nr-btn nr-btn-primary nr-btn-sm mt-4"
            >
              {t("inviteMembers")}
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-1">
          {participants.map((p) => {
            const isLead = p.role === "owner" || p.role === "admin";
            return (
              <li key={p.user_id}>
                <div className="flex items-center gap-3 rounded-2xl px-2 py-2">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar
                      avatar_url={p.avatar_url}
                      name={p.display_name || "?"}
                      size={10}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] font-medium text-(--nr-ink)">
                          {p.display_name || t("invitePersonUnnamed")}
                          {p.user_id === currentUserId && (
                            <span className="text-(--nr-faint)">
                              {" "}
                              {t("youSuffix")}
                            </span>
                          )}
                        </span>
                        {isLead && (
                          <LuCrown
                            size={13}
                            className="shrink-0 text-(--nr-yellow-deep)"
                            aria-label={t("memberRoleOwner")}
                          />
                        )}
                      </span>
                    </span>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                      STATUS_STYLE[p.status]
                    }`}
                  >
                    {p.status === "joined" || p.status === "accepted" ? (
                      <LuCheck size={12} className="inline" />
                    ) : p.status === "pending" ? (
                      <LuClock size={12} className="inline" />
                    ) : (
                      <LuX size={12} className="inline" />
                    )}
                    <span className="ml-1">
                      {p.status === "pending"
                        ? t("memberStatusPending")
                        : p.status === "declined"
                        ? t("memberStatusDeclined")
                        : t("memberStatusJoined")}
                    </span>
                  </span>

                  {drawn && (
                    <Link
                      href={`/users/${p.user_id}`}
                      className="shrink-0 text-[13px] font-semibold text-(--nr-gold-strong)"
                    >
                      {t("viewWishlist")}
                    </Link>
                  )}

                  {isAdmin &&
                    !drawn &&
                    p.user_id !== event.owner_id &&
                    p.user_id !== currentUserId && (
                      <button
                        onClick={() => remove(p)}
                        disabled={busyId === p.user_id}
                        aria-label={t("removeParticipant")}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-(--nr-faint) transition hover:bg-(--nr-error-soft) hover:text-(--nr-error-ink) disabled:opacity-40"
                      >
                        <LuUserMinus size={14} />
                      </button>
                    )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
