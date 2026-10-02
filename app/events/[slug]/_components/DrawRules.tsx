"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { LuArrowLeftRight, LuArrowRight, LuCheck, LuChevronDown, LuChevronRight, LuLink, LuX } from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { qq } from "@/utils/qq";
import { setPairRule, type PairRule } from "@/app/actions/events/drawRules";
import { updateEvent } from "@/app/actions/events/manage";
import type { DrawCheck, Participant, SsEvent } from "@/types/secret-santa";

/** One ss_exclusions row: a must not draw b; with mutual, b must not draw a either. */
type Rule = { a: string; b: string; mutual: boolean };
type LinkableEvent = { id: string; name: string; event_date: string | null; created_at: string };

/** The rule between x and y, as setPairRule understands it. */
function ruleBetween(rules: Rule[], x: string, y: string): PairRule {
  let xy = false;
  let yx = false;
  for (const r of rules) {
    if (r.a === x && r.b === y) {
      xy = true;
      if (r.mutual) yx = true;
    } else if (r.a === y && r.b === x) {
      yx = true;
      if (r.mutual) xy = true;
    }
  }
  return xy && yx ? "both" : xy ? "x_to_y" : yx ? "y_to_x" : "none";
}

/**
 * Who must not draw whom, person by person.
 *
 * The card lists everyone with a one-line summary; tapping a person opens a
 * sheet to tick who they can't draw. A rule is two-way by default (partners:
 * neither draws the other) and can be made one-way ("Ona drew Rūta last year,
 * so not again", while Rūta may still draw Ona). Stored in ss_exclusions with a
 * direction (migration 20261002120000) and applied by the draw engine.
 *
 * Below: last year's event (avoid repeating its pairs automatically) and a
 * status line from ss_check_draw, refreshed on every rule or roster change.
 */
export default function DrawRules({
  slug,
  event,
  participants,
  currentUserId,
}: {
  slug: string;
  event: SsEvent;
  participants: Participant[];
  currentUserId: string;
}) {
  const sb = createClient();
  const qc = useQueryClient();
  const t = useTranslations("Events");
  const locale = useLocale();
  const eventId = event.id;

  // ---- rules ----------------------------------------------------------------

  const { data: rules = [] } = useQuery<Rule[]>({
    queryKey: qq.drawRules(eventId),
    queryFn: async () => {
      const { data, error } = await sb.from("ss_exclusions").select("a, b, mutual").eq("event_id", eventId);
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });

  const joined = useMemo(() => participants.filter((p) => p.status === "joined"), [participants]);
  const byId = useMemo(() => new Map(participants.map((p) => [p.user_id, p])), [participants]);
  const nameOf = (id: string) => byId.get(id)?.display_name || t("invitePersonUnnamed");
  const list = (ids: string[]) =>
    new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(ids.map(nameOf));

  /** Who `giver` can't draw, with whether the rule is two-way. */
  const blockedFor = (giver: string) =>
    joined
      .filter((p) => p.user_id !== giver)
      .map((p) => ({ id: p.user_id, rule: ruleBetween(rules, giver, p.user_id) }))
      .filter((x) => x.rule === "both" || x.rule === "x_to_y");

  const [editing, setEditing] = useState<string | null>(null);

  // ---- last year ----------------------------------------------------------

  const { data: linkable = [] } = useQuery<LinkableEvent[]>({
    queryKey: ["ss:linkableEvents", currentUserId, event.type, eventId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("ss_events")
        .select("id, name, event_date, created_at")
        .eq("owner_id", currentUserId)
        .eq("status", "drawn")
        .eq("type", event.type)
        .neq("id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LinkableEvent[];
    },
  });

  const { data: previous } = useQuery({
    enabled: !!event.previous_event_id,
    queryKey: ["ss:previousEvent", event.previous_event_id],
    queryFn: async () => {
      const prevId = event.previous_event_id!;
      const [{ data: ev }, { data: rows }, { data: people }] = await Promise.all([
        sb.from("ss_events").select("id, name").eq("id", prevId).maybeSingle(),
        // RLS: only an organiser of last year's event can read all its pairs.
        sb.from("ss_assignments").select("giver, receiver").eq("event_id", prevId),
        sb.from("ss_participants").select("user_id, display_name").eq("event_id", prevId),
      ]);
      const names = new Map((people ?? []).map((p) => [p.user_id as string, p.display_name as string]));
      return {
        name: (ev?.name as string | undefined) ?? "",
        pairs: (rows ?? []).map((r) => ({
          giver: names.get(r.giver as string) || t("invitePersonUnnamed"),
          receiver: names.get(r.receiver as string) || t("invitePersonUnnamed"),
        })),
      };
    },
  });

  const [picking, setPicking] = useState(false);
  const [showPairs, setShowPairs] = useState(false);

  const patchEvent = useMutation({
    mutationFn: async (patch: { avoid_previous_match?: boolean; previous_event_id?: string | null }) => {
      const res = await updateEvent(slug, patch);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => {
      setPicking(false);
      qc.invalidateQueries({ queryKey: qq.event(slug) });
      qc.invalidateQueries({ queryKey: ["ss:drawCheck", eventId] });
    },
    onError: () => toast.error(t("settingsSaveFailed")),
  });

  // ---- status line ----------------------------------------------------------

  const rosterKey = joined.map((p) => p.user_id).sort().join(",");
  const rulesKey = rules
    .map((r) => `${r.a}:${r.b}:${r.mutual ? 2 : 1}`)
    .sort()
    .join(",");
  const { data: check } = useQuery<DrawCheck>({
    queryKey: ["ss:drawCheck", eventId, rosterKey, rulesKey, event.previous_event_id, event.avoid_previous_match],
    queryFn: async () => {
      const { data, error } = await sb.rpc("ss_check_draw", { p_event_id: eventId });
      if (error) throw error;
      return data as DrawCheck;
    },
  });

  const status = (() => {
    if (!check) return null;
    switch (check.reason ?? check.status) {
      case "ok":
        return { tone: "ok", text: t("drawStatusOk") };
      case "relaxed":
        return { tone: "warn", text: t("drawCheckRelaxed", { repeats: check.repeats }) };
      case "predictable":
        return { tone: "warn", text: t("drawCheckPredictable") };
      case "too_few":
        return { tone: "bad", text: t("drawCheckTooFew", { min: check.min ?? 0, count: check.count }) };
      case "no_recipient":
        return { tone: "bad", text: t("drawCheckNoRecipient", { name: list(check.people.slice(0, 1)) }) };
      case "household_too_big":
        return {
          tone: "bad",
          text: t("drawCheckHousehold", { names: list(check.people), k: check.people.length, n: check.count }),
        };
      default:
        return { tone: "bad", text: t("drawCheckOther") };
    }
  })();

  // ---- render -----------------------------------------------------------------

  return (
    <div>
      <div className="nr-card p-5">
        <h2 className="nr-h3 text-[16px]">{t("drawRulesTitle")}</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-(--nr-muted)">{t("rulesBody")}</p>

        <ul className="mt-4 space-y-1" data-testid="rules-people">
          {joined.map((p) => {
            const blocked = blockedFor(p.user_id);
            return (
              <li key={p.user_id}>
                <button
                  onClick={() => setEditing(p.user_id)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-[16px] px-2 py-2 text-left transition hover:bg-(--nr-cream)"
                >
                  <PersonDot person={p} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-(--nr-ink)">
                      {p.display_name || t("invitePersonUnnamed")}
                    </span>
                    <span className="block truncate text-[13px] text-(--nr-muted)">
                      {blocked.length === 0 ? (
                        t("rulesCanDrawAnyone")
                      ) : (
                        <>
                          {t("rulesCantDrawPrefix")}{" "}
                          {blocked.map((b, i) => (
                            <span key={b.id} className="whitespace-nowrap text-(--nr-ink-2)">
                              {i > 0 && ", "}
                              {nameOf(b.id)}
                              {b.rule === "both" ? (
                                <LuArrowLeftRight className="ml-0.5 inline w-3.5" aria-label={t("rulesMutualShort")} />
                              ) : (
                                <LuArrowRight className="ml-0.5 inline w-3.5" aria-label={t("rulesOneWayShort")} />
                              )}
                            </span>
                          ))}
                        </>
                      )}
                    </span>
                  </span>
                  <LuChevronRight className="shrink-0 text-(--nr-faint)" />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 border-t border-(--nr-border) pt-4">
          <h3 className="text-[14px] font-semibold text-(--nr-ink)">{t("lastYearTitle")}</h3>
          {event.previous_event_id ? (
            <>
              <label className="mt-3 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="toggle toggle-sm mt-0.5"
                  checked={event.avoid_previous_match ?? true}
                  disabled={patchEvent.isPending}
                  onChange={(e) => patchEvent.mutate({ avoid_previous_match: e.target.checked })}
                />
                <span className="text-[14px] leading-snug text-(--nr-ink-2)">
                  {t("lastYearAvoid", { name: previous?.name ?? "…" })}
                </span>
              </label>
              {(previous?.pairs.length ?? 0) > 0 && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowPairs((v) => !v)}
                    aria-expanded={showPairs}
                    className="flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-(--nr-gold-strong)"
                  >
                    {t("lastYearPairs", { count: previous!.pairs.length })}
                    <LuChevronDown className={`transition ${showPairs ? "rotate-180" : ""}`} />
                  </button>
                  {showPairs && (
                    <ul className="mt-2 space-y-1 text-[13px] text-(--nr-ink-2)">
                      {previous!.pairs.map((p, i) => (
                        <li key={i}>
                          {p.giver} → {p.receiver}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <button
                onClick={() => patchEvent.mutate({ previous_event_id: null })}
                disabled={patchEvent.isPending}
                className="mt-3 text-[13px] text-(--nr-muted) underline underline-offset-2"
              >
                {t("lastYearUnlink")}
              </button>
            </>
          ) : picking ? (
            linkable.length === 0 ? (
              <p className="mt-2 text-[14px] text-(--nr-muted)">{t("lastYearNone")}</p>
            ) : (
              <ul className="mt-2 space-y-1" data-testid="link-picker">
                {linkable.map((ev) => (
                  <li key={ev.id}>
                    <button
                      onClick={() => patchEvent.mutate({ previous_event_id: ev.id, avoid_previous_match: true })}
                      disabled={patchEvent.isPending}
                      className="w-full cursor-pointer rounded-[14px] px-3 py-2 text-left text-[14px] text-(--nr-ink) transition hover:bg-(--nr-cream)"
                    >
                      {ev.name}
                      <span className="ml-2 text-(--nr-faint)">
                        {String(ev.event_date ?? ev.created_at).slice(0, 4)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <>
              <p className="mt-1 text-[14px] text-(--nr-muted)">{t("lastYearBody")}</p>
              <button
                onClick={() => setPicking(true)}
                className="nr-btn nr-btn-outline nr-btn-sm mt-3 cursor-pointer"
              >
                <LuLink className="w-4" />
                {t("lastYearLink")}
              </button>
            </>
          )}
        </div>
      </div>

      {status && (
        <p
          role="status"
          data-testid="draw-status"
          data-tone={status.tone}
          className={`mt-2 flex items-start gap-2 px-2 text-[13px] leading-snug ${
            status.tone === "ok"
              ? "text-(--nr-success-ink)"
              : status.tone === "warn"
              ? "text-(--nr-gold-strong)"
              : "text-(--nr-error-ink)"
          }`}
        >
          <span
            aria-hidden
            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
              status.tone === "ok" ? "bg-green-600" : status.tone === "warn" ? "bg-amber-500" : "bg-red-600"
            }`}
          />
          {status.text}
        </p>
      )}

      {editing && byId.get(editing) && (
        <PersonRulesSheet
          key={editing}
          slug={slug}
          person={byId.get(editing)!}
          others={joined.filter((p) => p.user_id !== editing)}
          rules={rules}
          nameOf={nameOf}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: qq.drawRules(eventId) });
            qc.invalidateQueries({ queryKey: ["ss:drawCheck", eventId] });
          }}
        />
      )}
    </div>
  );
}


/**
 * Who one person can't draw. Each ticked person gets a "both ways" switch,
 * on by default (partners). Saved on Save, pair by pair, only where changed.
 */
function PersonRulesSheet({
  slug,
  person,
  others,
  rules,
  nameOf,
  onClose,
  onSaved,
}: {
  slug: string;
  person: Participant;
  others: Participant[];
  rules: Rule[];
  nameOf: (id: string) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Events");
  const me = person.user_id;
  const initial = useMemo(
    () => new Map(others.map((o) => [o.user_id, ruleBetween(rules, me, o.user_id)])),
    [others, rules, me]
  );
  const [draft, setDraft] = useState(() =>
    new Map(
      others.map((o) => {
        const r = initial.get(o.user_id)!;
        return [o.user_id, { blocked: r === "both" || r === "x_to_y", mutual: r !== "x_to_y" }];
      })
    )
  );
  const [saving, setSaving] = useState(false);

  const next = (id: string): PairRule => {
    const d = draft.get(id)!;
    if (d.blocked) return d.mutual ? "both" : "x_to_y";
    // Unticking only removes this person's side; the other's one-way rule stays.
    return initial.get(id) === "y_to_x" ? "y_to_x" : "none";
  };
  const changed = others.filter((o) => next(o.user_id) !== initial.get(o.user_id));

  const save = async () => {
    setSaving(true);
    const results = await Promise.all(changed.map((o) => setPairRule(slug, me, o.user_id, next(o.user_id))));
    setSaving(false);
    if (results.some((r) => !r.ok)) {
      toast.error(t("drawRuleSaveFailed"));
      return;
    }
    onSaved();
  };

  const set = (id: string, patch: Partial<{ blocked: boolean; mutual: boolean }>) =>
    setDraft((prev) => new Map(prev).set(id, { ...prev.get(id)!, ...patch }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-(--nr-ink)/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="person-rules-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-[28px] bg-(--nr-surface) sm:max-w-[460px] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-(--nr-border) px-5 py-4">
          <PersonDot person={person} size={36} />
          <h2 id="person-rules-title" className="nr-h3 flex-1 text-[18px]">
            {t("rulesSheetTitle", { name: nameOf(me) })}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="grid h-8 w-8 place-items-center rounded-full text-(--nr-muted) transition hover:bg-(--nr-tile) hover:text-(--nr-ink)"
          >
            <LuX />
          </button>
        </header>

        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {others.map((o) => {
            const d = draft.get(o.user_id)!;
            const incoming = initial.get(o.user_id) === "y_to_x" && !d.blocked;
            return (
              <li key={o.user_id} className="rounded-[16px] px-2 py-2">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={d.blocked}
                    onChange={(e) => set(o.user_id, { blocked: e.target.checked })}
                  />
                  {/* The theme's checkbox drew no visible tick; this one does. */}
                  <span
                    aria-hidden
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition peer-focus-visible:ring-2 peer-focus-visible:ring-(--nr-ink) ${
                      d.blocked
                        ? "border-(--nr-yellow-deep) bg-(--nr-yellow) text-(--nr-ink)"
                        : "border-(--nr-border) bg-(--nr-surface)"
                    }`}
                  >
                    {d.blocked && <LuCheck size={14} />}
                  </span>
                  <PersonDot person={o} size={32} />
                  <span className="min-w-0 flex-1 truncate text-[15px] text-(--nr-ink)">{nameOf(o.user_id)}</span>
                </label>
                {d.blocked && (
                  <div className="ml-[36px] mt-2">
                    {/* Two explicit options, not a switch: which way the rule
                        works is the decision here, and a switch's off state
                        read as ambiguous. */}
                    <div
                      role="radiogroup"
                      aria-label={t("rulesDirection")}
                      className="inline-flex rounded-full bg-(--nr-cream) p-1 text-[13px]"
                    >
                      {([true, false] as const).map((m) => (
                        <button
                          key={String(m)}
                          type="button"
                          role="radio"
                          aria-checked={d.mutual === m}
                          onClick={() => set(o.user_id, { mutual: m })}
                          className={`flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 font-semibold transition ${
                            d.mutual === m
                              ? "bg-(--nr-ink) text-white"
                              : "text-(--nr-muted) hover:text-(--nr-ink)"
                          }`}
                        >
                          {m ? <LuArrowLeftRight className="w-3.5" /> : <LuArrowRight className="w-3.5" />}
                          {m ? t("rulesMutual") : t("rulesOneWay")}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[12px] leading-snug text-(--nr-muted)">
                      {d.mutual
                        ? t("rulesMutualHint", { other: nameOf(o.user_id), name: nameOf(me) })
                        : t("rulesOneWayHint", { other: nameOf(o.user_id), name: nameOf(me) })}
                    </p>
                  </div>
                )}
                {incoming && (
                  <p className="ml-[36px] mt-1 text-[12px] text-(--nr-muted)">
                    {t("rulesIncomingHint", { other: nameOf(o.user_id), name: nameOf(me) })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <footer className="flex gap-2 border-t border-(--nr-border) px-5 pb-[max(1.1rem,env(safe-area-inset-bottom))] pt-3">
          <button onClick={onClose} className="nr-btn nr-btn-outline flex-1">
            {t("cancel")}
          </button>
          <button
            onClick={save}
            disabled={saving || changed.length === 0}
            className="nr-btn nr-btn-dark flex-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("rulesSave")}
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Small avatar: photo or initial, sized in px so groups can overlap. */
function PersonDot({
  person,
  size,
  ring,
  selected,
}: {
  person?: Participant;
  size: number;
  ring?: boolean;
  selected?: boolean;
}) {
  const name = person?.display_name || "?";
  const border = selected
    ? "outline outline-[3px] outline-(--nr-yellow-deep)"
    : ring
    ? "outline outline-2 outline-(--nr-cream)"
    : "";
  return person?.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={person.avatar_url}
      alt={name}
      title={name}
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover ${border}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      title={name}
      className={`grid shrink-0 place-items-center rounded-full bg-(--nr-tile) font-semibold text-(--nr-ink) ${border}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
