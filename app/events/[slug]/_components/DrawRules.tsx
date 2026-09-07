"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { LuArrowLeftRight, LuPlus, LuX } from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { qq } from "@/utils/qq";
import { addDrawRule, removeDrawRule } from "@/app/actions/events/drawRules";
import type { Participant } from "@/types/secret-santa";

type Pair = { a: string; b: string };

/**
 * Who must not draw whom, as a list of pairs.
 *
 * The previous version turned the roster into a hidden control: clicking a
 * participant — with nothing to say you could — revealed a separate card
 * *below* the roster holding a checkbox per other person. Setting rules for
 * three couples meant six trips up and down the page, which on a phone is the
 * whole screen scrolling each time.
 *
 * It was also a per-person, one-directional model on top of an engine that
 * applies every rule both ways, so the copy had to keep apologising for the
 * difference. A pair is what the engine stores, what the organiser means, and
 * what fits on one screen.
 */
export default function DrawRules({
  slug,
  eventId,
  participants,
}: {
  slug: string;
  eventId: string;
  participants: Participant[];
}) {
  const sb = createClient();
  const qc = useQueryClient();
  const t = useTranslations("Events");
  const [personA, setPersonA] = useState("");
  const [personB, setPersonB] = useState("");

  const { data: pairs = [] } = useQuery<Pair[]>({
    queryKey: qq.drawRules(eventId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("ss_exclusions")
        .select("a, b")
        .eq("event_id", eventId);
      if (error) throw error;
      // Rows written by the old screen can hold both orientations of the same
      // rule; collapse them so a couple appears once.
      const seen = new Set<string>();
      const out: Pair[] = [];
      for (const row of data ?? []) {
        const [a, b] = row.a < row.b ? [row.a, row.b] : [row.b, row.a];
        const key = `${a}:${b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ a, b });
      }
      return out;
    },
  });

  // A rule naming somebody who has since left constrains nothing — runDraw
  // already skips it — and would render as "Participant ↔ …". Real data has
  // these: one live event carries two.
  const present = useMemo(
    () => new Set(participants.map((p) => p.user_id)),
    [participants]
  );
  const livePairs = useMemo(
    () => pairs.filter((p) => present.has(p.a) && present.has(p.b)),
    [pairs, present]
  );

  const nameOf = useMemo(() => {
    const map = new Map(
      participants.map((p) => [p.user_id, p.display_name || ""])
    );
    return (id: string) => map.get(id) || t("invitePersonUnnamed");
  }, [participants, t]);

  const add = useMutation({
    mutationFn: async () => {
      const res = await addDrawRule(slug, personA, personB);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => {
      setPersonA("");
      setPersonB("");
      qc.invalidateQueries({ queryKey: qq.drawRules(eventId) });
    },
    onError: () => toast.error(t("drawRuleSaveFailed")),
  });

  const remove = useMutation({
    mutationFn: async (pair: Pair) => {
      const res = await removeDrawRule(slug, pair.a, pair.b);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qq.drawRules(eventId) }),
    onError: () => toast.error(t("drawRuleSaveFailed")),
  });

  // Don't offer a pair that already exists, or a person paired with themselves.
  const alreadyPaired = useMemo(
    () => new Set(pairs.map((p) => `${p.a}:${p.b}`)),
    [pairs]
  );
  const chosenKey =
    personA && personB
      ? personA < personB
        ? `${personA}:${personB}`
        : `${personB}:${personA}`
      : "";
  const duplicate = !!chosenKey && alreadyPaired.has(chosenKey);
  const canAdd =
    !!personA && !!personB && personA !== personB && !duplicate && !add.isPending;

  const select =
    "w-full rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-cream) px-3 py-2.5 text-[15px] text-(--nr-ink) outline-none transition focus:border-(--nr-yellow-deep)";

  return (
    <div className="nr-card p-5">
      <h2 className="nr-h3 text-[16px]">{t("drawRulesTitle")}</h2>
      <p className="mt-1 text-[14px] leading-relaxed text-(--nr-muted)">
        {t("drawRulesBody")}
      </p>

      {livePairs.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {livePairs.map((pair) => (
            <li
              key={`${pair.a}:${pair.b}`}
              className="flex items-center gap-2 rounded-[16px] bg-(--nr-cream) py-2 pl-3.5 pr-2"
            >
              <span className="min-w-0 flex-1 text-[15px] text-(--nr-ink)">
                <span className="font-medium">{nameOf(pair.a)}</span>
                <LuArrowLeftRight
                  className="mx-2 inline w-4 text-(--nr-gold-strong)"
                  aria-label={t("drawRulesPairWith")}
                />
                <span className="font-medium">{nameOf(pair.b)}</span>
              </span>
              <button
                onClick={() => remove.mutate(pair)}
                disabled={remove.isPending}
                aria-label={t("drawRulesRemove")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-(--nr-faint) transition hover:bg-(--nr-error-soft) hover:text-(--nr-error-ink) disabled:opacity-40"
              >
                <LuX size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Native selects on purpose: on a phone they open the OS picker instead
          of a scroll region nested inside an already-scrolling page. */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={personA}
          onChange={(e) => setPersonA(e.target.value)}
          className={select}
          aria-label={t("drawRulesPersonA")}
        >
          <option value="">{t("drawRulesPersonA")}</option>
          {participants.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.display_name || t("invitePersonUnnamed")}
            </option>
          ))}
        </select>

        <LuArrowLeftRight
          className="mx-auto w-4 shrink-0 rotate-90 text-(--nr-faint) sm:rotate-0"
          aria-hidden
        />

        <select
          value={personB}
          onChange={(e) => setPersonB(e.target.value)}
          className={select}
          aria-label={t("drawRulesPersonB")}
        >
          <option value="">{t("drawRulesPersonB")}</option>
          {participants
            .filter((p) => p.user_id !== personA)
            .map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.display_name || t("invitePersonUnnamed")}
              </option>
            ))}
        </select>

        <button
          onClick={() => add.mutate()}
          disabled={!canAdd}
          className="nr-btn nr-btn-outline nr-btn-sm shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LuPlus className="w-4" />
          {t("drawRulesAdd")}
        </button>
      </div>

      {duplicate && (
        <p className="mt-2 text-[13px] text-(--nr-muted)">
          {t("drawRulesDuplicate")}
        </p>
      )}
    </div>
  );
}
