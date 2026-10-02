"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import {
  LuCheck,
  LuCopy,
  LuLink,
  LuMail,
  LuRefreshCw,
  LuSearch,
  LuTrash2,
  LuUserPlus,
  LuX,
} from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { foldForSearch } from "@/utils/helpers/search";
import { qq } from "@/utils/qq";
import { Avatar } from "@/components/Avatar";
import type { Participant, SsEventInvite } from "@/types/secret-santa";
import {
  inviteByEmail,
  inviteUsers,
  revokeEmailInvite,
  rotateJoinLink,
} from "@/app/actions/events/invite";

type Tab = "people" | "email" | "link";
type FoundProfile = { id: string; display_name: string | null; avatar_url: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The three ways into an event, in one sheet.
 *
 * The previous modal offered exactly one: pick from the people you already
 * follow. If your family were not followed accounts, there was no way to
 * invite them at all — which is the hole this closes. Search covers people
 * already on Noriuto, e-mail covers everyone else, and the link covers the
 * group chat where most of this actually gets organised.
 */
export default function InvitePeopleSheet({
  slug,
  eventId,
  joinToken,
  participants,
  open,
  onClose,
}: {
  slug: string;
  eventId: string;
  joinToken: string;
  participants: Participant[];
  open: boolean;
  onClose: () => void;
}) {
  const sb = createClient();
  const qc = useQueryClient();
  const t = useTranslations("Events");
  const locale = useLocale();

  const [tab, setTab] = useState<Tab>("people");
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  // A Map, not a Set of ids: the tray shows names and faces for people who
  // are no longer in the current search results.
  const [selected, setSelected] = useState<Map<string, FoundProfile>>(new Map());
  // Ids whose invitation failed on the last send; they stay selected.
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [emailValue, setEmailValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState(joinToken);

  useEffect(() => setToken(joinToken), [joinToken]);

  useEffect(() => {
    if (!open) {
      setTab("people");
      setTerm("");
      setSelected(new Map());
      setFailed(new Set());
      setEmailValue("");
    }
  }, [open]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(id);
  }, [term]);

  const joinUrl = useMemo(
    () =>
      typeof window === "undefined"
        ? ""
        : `${window.location.origin}/events/join/${token}`,
    [token]
  );

  // People already in the event stay in the results, marked, so a search for
  // them doesn't look broken; they just can't be picked again. A declined
  // invitation can be re-sent, so declined people are pickable.
  const rosterStatus = useMemo(
    () => new Map(participants.map((p) => [p.user_id, p.status])),
    [participants]
  );

  const { data: found = [], isFetching } = useQuery<FoundProfile[]>({
    enabled: open && tab === "people" && debounced.trim().length >= 2,
    queryKey: ["ss:peopleSearch", debounced],
    queryFn: async () => {
      const { data, error } = await sb
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("public", true)
        .ilike("display_name_norm", `%${foldForSearch(debounced)}%`)
        .order("display_name", { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as FoundProfile[];
    },
  });

  const { data: emailInvites = [] } = useQuery<SsEventInvite[]>({
    enabled: open,
    queryKey: qq.emailInvites(eventId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("ss_event_invites")
        .select("*")
        .eq("event_id", eventId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SsEventInvite[];
    },
  });

  const lockedLabel = (id: string): string | null => {
    const st = rosterStatus.get(id);
    if (st === "joined" || st === "accepted") return t("inviteInEvent");
    if (st === "pending") return t("inviteAlreadyInvited");
    return null;
  };

  const refreshRoster = () => {
    qc.invalidateQueries({ queryKey: qq.participants(eventId) });
    qc.invalidateQueries({ queryKey: qq.members(eventId) });
    qc.invalidateQueries({ queryKey: qq.invites(eventId) });
    qc.invalidateQueries({ queryKey: qq.emailInvites(eventId) });
  };

  const toggle = (p: FoundProfile) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.set(p.id, p);
      return next;
    });
    setFailed((prev) => {
      if (!prev.has(p.id)) return prev;
      const next = new Set(prev);
      next.delete(p.id);
      return next;
    });
  };

  const firstName = (p?: FoundProfile) =>
    (p?.display_name ?? "").trim().split(/\s+/)[0] || t("invitePersonUnnamed");

  const submitPeople = async () => {
    if (!selected.size) return;
    setBusy(true);
    const res = await inviteUsers(slug, Array.from(selected.keys()));
    setBusy(false);
    const failedIds = new Set(res.failed ?? []);
    if (!res.ok && failedIds.size === 0) {
      toast.error(t("inviteError"));
      return;
    }
    if ((res.sent ?? 0) > 0) toast.success(t("inviteSentCount", { count: res.sent ?? 0 }));
    // Keep exactly the people who failed, marked, so a retry is one tap.
    setSelected((prev) => new Map([...prev].filter(([id]) => failedIds.has(id))));
    setFailed(failedIds);
    if (failedIds.size === 0) setTerm("");
    refreshRoster();
  };

  // Tray: wraps to two rows, then "+N more". Rendered in full once to measure
  // where rows break, then cut to what fits (leaving room for the +N chip).
  const trayRef = useRef<HTMLDivElement>(null);
  const [trayExpanded, setTrayExpanded] = useState(false);
  const [trayLimit, setTrayLimit] = useState<number | null>(null);
  const selectionKey = Array.from(selected.keys()).join(",");
  useEffect(() => setTrayLimit(null), [selectionKey, trayExpanded]);
  useLayoutEffect(() => {
    if (trayExpanded || trayLimit !== null || !trayRef.current) return;
    const chips = Array.from(trayRef.current.querySelectorAll<HTMLElement>("[data-chip]"));
    const rows = [...new Set(chips.map((c) => c.offsetTop))].sort((a, b) => a - b);
    if (rows.length <= 2) return;
    const fit = chips.filter((c) => c.offsetTop <= rows[1]).length;
    setTrayLimit(Math.max(fit - 1, 1));
  }, [selectionKey, trayExpanded, trayLimit]);

  const people = Array.from(selected.values());
  const shown = trayLimit === null || trayExpanded ? people : people.slice(0, trayLimit);
  const hiddenCount = people.length - shown.length;
  const failedNames = people.filter((p) => failed.has(p.id)).map((p) => firstName(p));

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = emailValue.trim();
    if (!EMAIL_RE.test(value)) {
      toast.error(t("inviteInvalidEmail"));
      return;
    }
    setBusy(true);
    const res = await inviteByEmail(slug, value);
    setBusy(false);
    if (!res.ok) {
      toast.error(t("inviteError"));
      return;
    }
    toast.success(res.emailSent ? t("inviteEmailSent") : t("inviteEmailQueued"));
    setEmailValue("");
    refreshRoster();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  const rotate = async () => {
    setBusy(true);
    const res = await rotateJoinLink(slug);
    setBusy(false);
    if (!res.ok || !res.token) {
      toast.error(t("inviteError"));
      return;
    }
    setToken(res.token);
    qc.invalidateQueries({ queryKey: qq.event(slug) });
    toast.success(t("linkRotated"));
  };

  const revoke = async (id: string) => {
    const res = await revokeEmailInvite(slug, id);
    if (!res.ok) {
      toast.error(t("inviteError"));
      return;
    }
    qc.invalidateQueries({ queryKey: qq.emailInvites(eventId) });
  };

  if (!open) return null;

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "people", label: t("inviteTabPeople"), icon: <LuSearch className="w-4" /> },
    { key: "email", label: t("inviteTabEmail"), icon: <LuMail className="w-4" /> },
    { key: "link", label: t("inviteTabLink"), icon: <LuLink className="w-4" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-(--nr-ink)/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-[28px] bg-(--nr-surface) sm:max-w-[480px] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-(--nr-border) px-5 py-4">
          <h2 className="nr-h3 flex-1 text-[19px]">{t("inviteTitle")}</h2>
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="grid h-8 w-8 place-items-center rounded-full text-(--nr-muted) transition hover:bg-(--nr-tile) hover:text-(--nr-ink)"
          >
            <LuX />
          </button>
        </header>

        <nav className="flex gap-1 border-b border-(--nr-border) px-3 pt-3">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-t-[12px] px-3 py-2.5 text-[14px] font-semibold transition ${
                tab === item.key
                  ? "bg-(--nr-tile) text-(--nr-ink)"
                  : "text-(--nr-muted) hover:text-(--nr-ink)"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {tab === "people" && (
            <>
              {people.length === 0 ? (
                <p className="mb-3 text-[13px] text-(--nr-faint)" data-testid="tray-empty">
                  {t("inviteTrayEmpty")}
                </p>
              ) : (
                <div ref={trayRef} className="mb-3 flex flex-wrap gap-1.5" data-testid="tray">
                  {shown.map((p) => {
                    const bad = failed.has(p.id);
                    return (
                      <span
                        key={p.id}
                        data-chip
                        className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-1.5 text-[13px] font-medium ${
                          bad
                            ? "bg-(--nr-error-soft) text-(--nr-error-ink)"
                            : "bg-(--nr-tile) text-(--nr-ink)"
                        }`}
                        title={bad ? t("inviteChipFailed") : undefined}
                      >
                        <Avatar avatar_url={p.avatar_url} name={p.display_name} size={6} />
                        <span className="max-w-[110px] truncate">{firstName(p)}</span>
                        <button
                          onClick={() => toggle(p)}
                          aria-label={t("inviteChipRemove", { name: firstName(p) })}
                          className="grid h-5 w-5 cursor-pointer place-items-center rounded-full transition hover:bg-black/10"
                        >
                          <LuX size={12} />
                        </button>
                      </span>
                    );
                  })}
                  {hiddenCount > 0 && (
                    <button
                      data-chip
                      onClick={() => setTrayExpanded(true)}
                      className="cursor-pointer rounded-full bg-(--nr-cream) px-2.5 py-1 text-[13px] font-semibold text-(--nr-gold-strong)"
                    >
                      {t("inviteTrayMore", { count: hiddenCount })}
                    </button>
                  )}
                </div>
              )}
              {failedNames.length > 0 && (
                <p className="mb-3 text-[13px] leading-snug text-(--nr-error-ink)" role="alert">
                  {t("inviteFailedSome", {
                    names: new Intl.ListFormat(locale, { type: "conjunction" }).format(failedNames),
                  })}
                </p>
              )}

              <div className="flex items-center gap-2 rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-cream) px-3 py-2.5">
                <LuSearch className="w-4 shrink-0 text-(--nr-faint)" />
                <input
                  autoFocus
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder={t("invitePeopleSearchPlaceholder")}
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-(--nr-faint)"
                />
              </div>

              {debounced.trim().length < 2 ? (
                <p className="px-1 py-8 text-center text-[14px] text-(--nr-muted)">
                  {t("invitePeopleHint")}
                </p>
              ) : isFetching ? (
                <div className="space-y-2 py-4">
                  <div className="nr-skeleton h-12 w-full rounded-2xl" />
                  <div className="nr-skeleton h-12 w-full rounded-2xl" />
                </div>
              ) : found.length === 0 ? (
                <p className="px-1 py-8 text-center text-[14px] text-(--nr-muted)">
                  {t("invitePeopleEmpty")}
                </p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {found.map((p) => {
                    const on = selected.has(p.id);
                    const locked = lockedLabel(p.id);
                    if (locked) {
                      return (
                        <li key={p.id}>
                          <div
                            className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 opacity-60"
                            aria-disabled="true"
                          >
                            <Avatar avatar_url={p.avatar_url} name={p.display_name} size={10} />
                            <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-(--nr-ink)">
                              {p.display_name ?? t("invitePersonUnnamed")}
                            </span>
                            <span className="shrink-0 text-[12px] font-semibold text-(--nr-muted)">
                              {locked}
                            </span>
                          </div>
                        </li>
                      );
                    }
                    return (
                      <li key={p.id}>
                        <button
                          onClick={() => toggle(p)}
                          aria-pressed={on}
                          className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-(--nr-tile)/55"
                        >
                          <Avatar
                            avatar_url={p.avatar_url}
                            name={p.display_name}
                            size={10}
                          />
                          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-(--nr-ink)">
                            {p.display_name ?? t("invitePersonUnnamed")}
                          </span>
                          <span
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition ${
                              on
                                ? "border-(--nr-yellow) bg-(--nr-yellow) text-(--nr-ink)"
                                : "border-(--nr-border) text-(--nr-faint)"
                            }`}
                            aria-hidden
                          >
                            {on ? <LuCheck size={14} /> : <LuUserPlus size={14} />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {tab === "email" && (
            <>
              <form onSubmit={submitEmail} className="flex gap-2">
                <input
                  autoFocus
                  type="email"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  placeholder={t("inviteEmailPlaceholder")}
                  className="min-w-0 flex-1 rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-cream) px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-(--nr-faint) focus:border-(--nr-yellow-deep)"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="nr-btn nr-btn-primary nr-btn-sm shrink-0 disabled:opacity-50"
                >
                  {t("ctaSend")}
                </button>
              </form>
              <p className="mt-2.5 text-[13px] leading-relaxed text-(--nr-faint)">
                {t("inviteEmailHelp")}
              </p>

              {emailInvites.length > 0 && (
                <div className="mt-6">
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-(--nr-faint)">
                    {t("inviteWaiting")}
                  </p>
                  <ul className="space-y-1">
                    {emailInvites.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex items-center gap-2 rounded-2xl bg-(--nr-cream) px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-[14px] text-(--nr-ink-2)">
                          {inv.email ?? t("inviteViaLink")}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${window.location.origin}/events/join/${inv.token}`
                            );
                            toast.success(t("linkCopied"));
                          }}
                          className="grid h-7 w-7 place-items-center rounded-full text-(--nr-muted) transition hover:bg-(--nr-tile)"
                          aria-label={t("copyInviteLink")}
                        >
                          <LuCopy size={13} />
                        </button>
                        <button
                          onClick={() => revoke(inv.id)}
                          className="grid h-7 w-7 place-items-center rounded-full text-(--nr-error-ink) transition hover:bg-(--nr-error-soft)"
                          aria-label={t("revokeInvite")}
                        >
                          <LuTrash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {tab === "link" && (
            <>
              <p className="mb-4 text-[15px] leading-relaxed text-(--nr-muted)">
                {t("inviteLinkBody")}
              </p>
              <div className="flex items-center gap-2 rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-cream) px-3.5 py-2.5">
                <LuLink className="w-4 shrink-0 text-(--nr-faint)" />
                <span className="min-w-0 flex-1 truncate text-[14px] text-(--nr-ink-2)">
                  {joinUrl}
                </span>
              </div>
              <button
                onClick={copyLink}
                className="nr-btn nr-btn-primary mt-3 w-full"
              >
                {copied ? <LuCheck /> : <LuCopy />}
                {copied ? t("linkCopied") : t("copyInviteLink")}
              </button>
              <button
                onClick={rotate}
                disabled={busy}
                className="nr-btn nr-btn-outline nr-btn-sm mt-2 w-full disabled:opacity-50"
              >
                <LuRefreshCw className="w-4" />
                {t("linkRotate")}
              </button>
              <p className="mt-2 text-[13px] leading-relaxed text-(--nr-faint)">
                {t("linkRotateHelp")}
              </p>
            </>
          )}
        </div>

        {tab === "people" && (
          <footer className="shrink-0 border-t border-(--nr-border) px-5 pb-[max(1.1rem,env(safe-area-inset-bottom))] pt-3">
            <button
              onClick={submitPeople}
              disabled={selected.size === 0 || busy}
              className="nr-btn nr-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {people.length
                ? t("inviteSendNamed", { name: firstName(people[0]), others: people.length - 1 })
                : t("inviteSelectNobody")}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
