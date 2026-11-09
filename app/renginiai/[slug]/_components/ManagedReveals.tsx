"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { LuEye, LuListChecks } from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { fetchRecipient, type Recipient } from "@/utils/events/recipient";
import type { Participant, SsEventType } from "@/types/secret-santa";
import { AvatarImg } from "@/components/AvatarImg";
import { PendingPips } from "@/components/ui/Pending";
import { IdeasNudge } from "@/components/discover/IdeasNudge";
import { bandForBudget, browseHref } from "@/app/idejos/_components/filters";

/**
 * After the draw: who each person the organiser looks after drew, so the
 * organiser can tell them. One compact list, not a reveal card per person —
 * the organiser is passing on results, not living the moment of their own
 * draw. Each result stays covered until tapped (that counts as a reveal and
 * closes the redraw window, like any other).
 */
export default function ManagedReveals({
  eventId,
  eventSlug,
  type,
  budget,
  people,
}: {
  eventId: string;
  eventSlug: string;
  type: SsEventType;
  budget: number | null;
  people: Participant[];
}) {
  const t = useTranslations("Events");
  if (people.length === 0) return null;
  const gifts = type === "secret_santa";

  return (
    <div className="nr-card p-5">
      <h2 className="nr-h3 text-[16px]">{t("managedRevealsTitle")}</h2>
      <p className="mt-1 text-[14px] leading-relaxed text-(--nr-muted)">
        {t("managedRevealsBody")}
      </p>

      <ul className="mt-3 divide-y divide-(--nr-border)">
        {people.map((p) => (
          <ManagedRow key={p.user_id} eventId={eventId} gifts={gifts} person={p} />
        ))}
      </ul>

      {gifts && (
        <IdeasNudge
          className="mt-1 border-t border-(--nr-border) pt-4"
          lead={t("managedIdeasLead")}
          cta={budget ? t("ideasCtaBudget", { budget }) : t("ideasCta")}
          href={
            eventSlug
              ? `/idejos?event=${encodeURIComponent(eventSlug)}`
              : browseHref({ price: bandForBudget(budget) })
          }
        />
      )}
    </div>
  );
}

function Face({
  name,
  src,
  size,
}: {
  name: string | null;
  src: string | null;
  size: "sm" | "md";
}) {
  const box = size === "md" ? "h-10 w-10 text-[15px]" : "h-8 w-8 text-[13px]";
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-(--nr-tile) font-semibold text-(--nr-ink) ${box}`}
      aria-hidden
    >
      <AvatarImg
        src={src}
        className="h-full w-full object-cover"
        fallback={(name ?? "?").trim().charAt(0).toUpperCase() || "?"}
      />
    </span>
  );
}

function ManagedRow({
  eventId,
  gifts,
  person,
}: {
  eventId: string;
  gifts: boolean;
  person: Participant;
}) {
  const sb = createClient();
  const qc = useQueryClient();
  const t = useTranslations("Events");
  const reduceMotion = useReducedMotion();
  const [revealing, setRevealing] = useState(false);
  const [justRevealed, setJustRevealed] = useState(false);
  const queryKey = ["ss:managedAssignment", eventId, person.user_id];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<{ receiver: Recipient | null; revealed: boolean } | null> => {
      const { data, error } = await sb.rpc("ss_managed_assignment", {
        p_event_id: eventId,
        p_member: person.user_id,
      });
      if (error) throw error;
      const row = data as { receiver: string; revealed: boolean } | null;
      if (!row) return null;
      return {
        receiver: await fetchRecipient(sb, eventId, row.receiver),
        revealed: !!row.revealed,
      };
    },
  });

  const reveal = async () => {
    if (revealing) return;
    setRevealing(true);
    // Remembered either way: a failed write only means the cover comes back
    // on the next visit, never that the result is lost.
    await sb
      .rpc("ss_mark_revealed_managed", { p_event_id: eventId, p_member: person.user_id })
      .then(
        () => undefined,
        () => undefined
      );
    setJustRevealed(true);
    qc.setQueryData(queryKey, data ? { ...data, revealed: true } : data);
    qc.invalidateQueries({ queryKey: ["ss:revealedCount", eventId] });
    setRevealing(false);
  };

  const receiver = data?.receiver ?? null;
  const shown = !!data?.revealed || justRevealed;

  return (
    <li className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 items-center gap-3 sm:w-[36%]">
        <Face name={person.display_name} src={person.avatar_url} size="md" />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-(--nr-ink)">
            {person.display_name || t("invitePersonUnnamed")}
          </span>
          <span className="block text-[13px] text-(--nr-muted)">
            {gifts ? t("managedGivesTo") : t("managedDrew")}
          </span>
        </span>
      </div>

      {/* Indented on phones so the result lines up under the giver's name. */}
      <div className="flex min-h-10 min-w-0 flex-1 items-center gap-3 pl-[52px] sm:pl-0">
        {isLoading ? (
          <PendingPips />
        ) : !receiver ? (
          <span className="text-[14px] text-(--nr-muted)">{t("drawnNoAssignment")}</span>
        ) : !shown ? (
          <button
            onClick={reveal}
            disabled={revealing}
            aria-busy={revealing || undefined}
            className="flex items-center gap-2 rounded-full border border-dashed border-(--nr-yellow-deep) px-3.5 py-2 text-[14px] font-semibold text-(--nr-gold-strong) transition hover:bg-(--nr-cream) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--nr-yellow-deep)"
          >
            {revealing ? <PendingPips /> : <LuEye className="w-4" aria-hidden />}
            {t("managedShowDraw")}
          </button>
        ) : (
          <motion.div
            className="flex min-w-0 flex-1 items-center gap-3"
            initial={justRevealed && !reduceMotion ? { opacity: 0, filter: "blur(6px)" } : false}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <Face name={receiver.display_name} src={receiver.avatar_url} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-heading text-[16px] font-bold text-(--nr-ink)">
                {receiver.display_name || t("invitePersonUnnamed")}
              </span>
              {gifts && receiver.wants && (
                <span
                  className="line-clamp-2 text-[13px] leading-snug text-(--nr-muted)"
                  title={receiver.wants}
                >
                  {receiver.wants}
                </span>
              )}
            </span>
            {gifts && receiver.hasWishlist && (
              <Link
                href={`/zmones/${receiver.id}?tab=wishlist`}
                className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-(--nr-gold-strong) underline-offset-2 hover:underline"
              >
                <LuListChecks size={14} aria-hidden />
                {t("managedRecipientWishlist")}
              </Link>
            )}
          </motion.div>
        )}
      </div>
    </li>
  );
}
