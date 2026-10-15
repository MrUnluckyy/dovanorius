"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LuMessageCircle, LuSendHorizontal, LuX } from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { CONTACT_EVENT, sendReport, type ContactContext } from "@/lib/report";

type Bubble = { from: "me" | "team"; text: string };

/** The thread survives a reload in this browser only; it is a convenience. */
const THREAD_KEY = "noriuto:contact-thread";
const EMAIL_KEY = "noriuto:contact-email";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or storage blocked: the chat still works, it just forgets */
  }
}

/** Where a support bubble would only get in the way. */
function hiddenOn(path: string): boolean {
  return (
    path.startsWith("/admin") ||
    path.startsWith("/partner") ||
    path.startsWith("/auth/confirm") ||
    path.startsWith("/studio")
  );
}

/**
 * "Write to us", on every page, one tap away.
 *
 * Looks like a chat because that is what people expect to find in the corner,
 * but replies go by email: nobody sits on a live inbox, and an honest "we'll
 * answer by email" beats a chat window that goes quiet. Messages land in
 * client_reports (area "contact") and are emailed to the team straight away.
 *
 * Mounted once in the root layout. Other code opens it with openContactChat(),
 * optionally with a reason and an opening line — that is how a page that
 * notices something odd offers help in context.
 */
export function ContactChat() {
  const t = useTranslations("Contact");
  const pathname = usePathname() ?? "/";

  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<ContactContext>({});
  const [thread, setThread] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [email, setEmail] = useState("");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setThread(load<Bubble[]>(THREAD_KEY, []));
    setEmail(load<string>(EMAIL_KEY, ""));

    const onOpen = (e: Event) => {
      setCtx((e as CustomEvent<ContactContext>).detail ?? {});
      setOpen(true);
    };
    window.addEventListener(CONTACT_EVENT, onOpen);
    return () => window.removeEventListener(CONTACT_EVENT, onOpen);
  }, []);

  // Only when opened: no auth call on every page view for a closed button.
  // getSession reads the local session, so this costs no request.
  useEffect(() => {
    if (!open || accountEmail !== null) return;
    createClient()
      .auth.getSession()
      .then(({ data }) => setAccountEmail(data.session?.user.email ?? ""));
  }, [open, accountEmail]);

  useEffect(() => {
    if (!open) return;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
    // Not on phones: the keyboard would cover the conversation on open.
    if (window.matchMedia("(min-width: 640px)").matches) input.current?.focus();
  }, [open, thread.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (hiddenOn(pathname)) return null;

  const replyTo = accountEmail || email.trim();
  const needsEmail = !accountEmail;

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setFailed(false);
    const ok = await sendReport({
      area: "contact",
      reason: ctx.reason,
      message: text,
      contactEmail: replyTo || undefined,
      detail: ctx.detail,
    });
    setSending(false);
    if (!ok) return setFailed(true);

    const next: Bubble[] = [
      ...thread,
      ...(ctx.prompt ? [{ from: "team" as const, text: ctx.prompt }] : []),
      { from: "me", text },
      {
        from: "team",
        text: replyTo
          ? t("receivedWithEmail", { email: replyTo })
          : t("receivedNoEmail"),
      },
    ];
    setThread(next);
    save(THREAD_KEY, next.slice(-30));
    if (needsEmail && email.trim()) save(EMAIL_KEY, email.trim());
    setDraft("");
    setCtx({});
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/30 sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {open && (
        <section
          role="dialog"
          aria-label={t("title")}
          className="fixed inset-x-0 bottom-0 z-[61] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-[28px] border border-(--nr-border) bg-(--nr-surface) shadow-(--nr-shadow-float) sm:inset-x-auto sm:bottom-24 sm:right-5 sm:max-h-[min(620px,calc(100dvh-8rem))] sm:w-[380px] sm:rounded-[28px]"
        >
          <header className="flex items-center gap-3 border-b border-(--nr-border) px-5 py-4">
            <span
              aria-hidden
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-(--nr-yellow) font-heading text-lg font-bold text-(--nr-ink)"
            >
              N
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight text-(--nr-ink)">
                {t("title")}
              </p>
              <p className="text-[13px] text-(--nr-muted)">{t("subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-(--nr-muted) transition hover:bg-(--nr-tile)"
            >
              <LuX size={18} />
            </button>
          </header>

          <div
            ref={scroller}
            className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4"
            aria-live="polite"
          >
            <TeamBubble>{t("greeting")}</TeamBubble>
            {thread.map((b, i) =>
              b.from === "me" ? (
                <MyBubble key={i}>{b.text}</MyBubble>
              ) : (
                <TeamBubble key={i}>{b.text}</TeamBubble>
              )
            )}
            {ctx.prompt && <TeamBubble>{ctx.prompt}</TeamBubble>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="border-t border-(--nr-border) px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
          >
            {needsEmail && (
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                aria-label={t("emailPlaceholder")}
                className="mb-2 w-full rounded-full border border-(--nr-border) bg-(--nr-cream) px-4 py-2 text-[15px] outline-none focus:border-(--nr-ink)"
              />
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={input}
                rows={1}
                maxLength={2000}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={t("placeholder")}
                aria-label={t("placeholder")}
                className="max-h-[140px] min-h-[44px] flex-1 resize-none rounded-[22px] border border-(--nr-border) bg-(--nr-cream) px-4 py-2.5 text-[15px] leading-snug outline-none focus:border-(--nr-ink)"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                aria-label={t("send")}
                className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-(--nr-ink) text-(--nr-cream) transition disabled:cursor-default disabled:opacity-40"
              >
                {sending ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <LuSendHorizontal size={18} />
                )}
              </button>
            </div>
            {failed && (
              <p className="mt-2 text-[13px] text-(--nr-error-ink)" role="alert">
                {t("sendFailed")}
              </p>
            )}
            {needsEmail && !failed && (
              <p className="mt-2 text-[12px] text-(--nr-faint)">{t("emailWhy")}</p>
            )}
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t("close") : t("launcher")}
        className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[59] flex h-14 cursor-pointer items-center gap-2 rounded-full bg-(--nr-ink) text-(--nr-cream) shadow-(--nr-shadow-float) transition hover:scale-[1.03] active:scale-95 sm:right-5 ${
          open ? "w-14 justify-center max-sm:hidden" : "w-14 justify-center sm:w-auto sm:px-5"
        }`}
      >
        {open ? (
          <LuX size={22} />
        ) : (
          <>
            <LuMessageCircle size={22} aria-hidden />
            <span className="hidden text-[15px] font-semibold sm:inline">
              {t("launcher")}
            </span>
          </>
        )}
      </button>
    </>
  );
}

function TeamBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[85%] w-fit whitespace-pre-line rounded-[20px] rounded-bl-md bg-(--nr-tile) px-4 py-2.5 text-[15px] leading-snug text-(--nr-ink)">
      {children}
    </div>
  );
}

function MyBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="ml-auto max-w-[85%] w-fit whitespace-pre-line rounded-[20px] rounded-br-md bg-(--nr-yellow) px-4 py-2.5 text-[15px] leading-snug text-(--nr-ink)">
      {children}
    </div>
  );
}
