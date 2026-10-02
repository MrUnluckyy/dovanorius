"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { LuCheck, LuChevronDown, LuHouse, LuLink, LuX } from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { qq } from "@/utils/qq";
import { addHousehold, removeHousehold } from "@/app/actions/events/drawRules";
import { updateEvent } from "@/app/actions/events/manage";
import type { DrawCheck, Participant, SsEvent } from "@/types/secret-santa";

type Pair = { a: string; b: string };
type LinkableEvent = { id: string; name: string; event_date: string | null; created_at: string };

/**
 * Who must not draw whom, as households.
 *
 * The engine stores pairs (ss_exclusions) and applies them both ways. People
 * think in households: "the three of us live together". A household is saved
 * as every pair inside it, and pairs load back as households by merging
 * connected pairs, so rules from the old two-dropdown screen show up as
 * two-person households.
 *
 * Below the households: last year's event (avoid repeating its pairs) and a
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

  // ---- households ---------------------------------------------------------

  const { data: pairs = [] } = useQuery<Pair[]>({
    queryKey: qq.drawRules(eventId),
    queryFn: async () => {
      const { data, error } = await sb.from("ss_exclusions").select("a, b").eq("event_id", eventId);
      if (error) throw error;
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

  const joined = useMemo(() => participants.filter((p) => p.status === "joined"), [participants]);
  const byId = useMemo(() => new Map(participants.map((p) => [p.user_id, p])), [participants]);
  const nameOf = (id: string) => byId.get(id)?.display_name || t("invitePersonUnnamed");

  // Connected pairs -> groups. A rule naming someone who left constrains
  // nothing (the engine skips it), so only present people count.
  const households = useMemo(() => {
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      while (parent.get(x) !== x) x = parent.get(x)!;
      return x;
    };
    for (const { a, b } of pairs) {
      if (!byId.has(a) || !byId.has(b)) continue;
      if (!parent.has(a)) parent.set(a, a);
      if (!parent.has(b)) parent.set(b, b);
      parent.set(find(a), find(b));
    }
    const groups = new Map<string, string[]>();
    for (const id of parent.keys()) {
      const root = find(id);
      groups.set(root, [...(groups.get(root) ?? []), id]);
    }
    return [...groups.values()].map((g) => g.sort()).sort((x, y) => y.length - x.length);
  }, [pairs, byId]);

  // Optional household names. ss_exclusions has nowhere to keep one (no schema
  // change for this), so they live in this browser, keyed by the members.
  const labelsKey = `nr:households:${eventId}`;
  const [labels, setLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      setLabels(JSON.parse(localStorage.getItem(labelsKey) ?? "{}"));
    } catch {
      setLabels({});
    }
  }, [labelsKey]);
  const saveLabel = (members: string[], label: string) => {
    const next = { ...labels, [members.slice().sort().join(",")]: label };
    if (!label) delete next[members.slice().sort().join(",")];
    setLabels(next);
    try {
      localStorage.setItem(labelsKey, JSON.stringify(next));
    } catch {
      /* private mode: the name just isn't remembered */
    }
  };

  const [creating, setCreating] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const invalidateRules = () => {
    qc.invalidateQueries({ queryKey: qq.drawRules(eventId) });
    qc.invalidateQueries({ queryKey: ["ss:drawCheck", eventId] });
  };

  const add = useMutation({
    mutationFn: async () => {
      const ids = [...picked];
      const res = await addHousehold(slug, ids);
      if (!res.ok) throw new Error(res.error);
      return ids;
    },
    onSuccess: (ids) => {
      if (newName.trim()) saveLabel(ids, newName.trim());
      setCreating(false);
      setPicked(new Set());
      setNewName("");
      invalidateRules();
    },
    onError: () => toast.error(t("drawRuleSaveFailed")),
  });

  const remove = useMutation({
    mutationFn: async (members: string[]) => {
      const res = await removeHousehold(slug, members);
      if (!res.ok) throw new Error(res.error);
      return members;
    },
    onSuccess: (members) => {
      saveLabel(members, "");
      invalidateRules();
    },
    onError: () => toast.error(t("drawRuleSaveFailed")),
  });

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
  const rulesKey = pairs.map((p) => `${p.a}:${p.b}`).join(",");
  const { data: check } = useQuery<DrawCheck>({
    queryKey: ["ss:drawCheck", eventId, rosterKey, rulesKey, event.previous_event_id, event.avoid_previous_match],
    queryFn: async () => {
      const { data, error } = await sb.rpc("ss_check_draw", { p_event_id: eventId });
      if (error) throw error;
      return data as DrawCheck;
    },
  });

  const list = (ids: string[]) =>
    new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(ids.map(nameOf));

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
        <p className="mt-1 text-[14px] leading-relaxed text-(--nr-muted)">{t("householdsBody")}</p>

        {households.length > 0 && (
          <ul className="mt-4 space-y-2">
            {households.map((members) => {
              const label = labels[members.join(",")];
              return (
                <li
                  key={members.join(",")}
                  className="flex items-center gap-3 rounded-[18px] bg-(--nr-cream) py-2.5 pl-3 pr-2"
                  data-testid="household"
                >
                  <div className="flex -space-x-2">
                    {members.map((id) => (
                      <PersonDot key={id} person={byId.get(id)} size={34} ring />
                    ))}
                  </div>
                  <span className="min-w-0 flex-1">
                    {label && (
                      <span className="block truncate text-[14px] font-semibold text-(--nr-ink)">{label}</span>
                    )}
                    <span className={`block truncate ${label ? "text-[13px] text-(--nr-muted)" : "text-[14px] font-medium text-(--nr-ink)"}`}>
                      {list(members)}
                    </span>
                  </span>
                  <button
                    onClick={() => remove.mutate(members)}
                    disabled={remove.isPending}
                    aria-label={t("householdRemove")}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-(--nr-faint) transition hover:bg-(--nr-error-soft) hover:text-(--nr-error-ink) disabled:opacity-40"
                  >
                    <LuX size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {creating ? (
          <div className="mt-4 rounded-[18px] border border-(--nr-border) p-4" data-testid="household-editor">
            <p className="text-[14px] font-semibold text-(--nr-ink)">{t("householdPick")}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {joined.map((p) => {
                const on = picked.has(p.user_id);
                return (
                  <button
                    key={p.user_id}
                    onClick={() => toggle(p.user_id)}
                    aria-pressed={on}
                    className="flex w-[68px] cursor-pointer flex-col items-center gap-1"
                  >
                    <span className="relative">
                      <PersonDot person={p} size={48} selected={on} />
                      {on && (
                        <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-(--nr-ink) text-white">
                          <LuCheck size={12} />
                        </span>
                      )}
                    </span>
                    <span className="w-full truncate text-center text-[12px] text-(--nr-ink-2)">
                      {p.display_name || t("invitePersonUnnamed")}
                    </span>
                  </button>
                );
              })}
            </div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("householdNamePlaceholder")}
              className="mt-4 w-full rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-cream) px-3 py-2.5 text-[15px] outline-none focus:border-(--nr-yellow-deep)"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => add.mutate()}
                disabled={picked.size < 2 || add.isPending}
                className="nr-btn nr-btn-dark nr-btn-sm flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {picked.size < 2 ? t("householdPickMore") : t("householdSave", { count: picked.size })}
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setPicked(new Set());
                  setNewName("");
                }}
                className="nr-btn nr-btn-outline nr-btn-sm"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="nr-btn nr-btn-outline nr-btn-sm mt-4 cursor-pointer"
          >
            <LuHouse className="w-4" />
            {t("householdNew")}
          </button>
        )}

        {/* Last year */}
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
