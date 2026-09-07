"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import toast from "react-hot-toast";
import { createClient } from "@/utils/supabase/client";
import { getEventTypeMeta } from "@/utils/events/typeMeta";
import { sendJoinedEmail } from "@/app/actions/events/invite";
import type { SsJoinInfo } from "@/types/secret-santa";

type AcceptResult = {
  ok?: boolean;
  error?: string;
  slug?: string;
  event_name?: string;
  already_member?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function JoinEventClient({
  token,
  info,
  isRealUser,
  knownName,
}: {
  token: string;
  info: SsJoinInfo;
  isRealUser: boolean;
  knownName: string | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const format = useFormatter();
  const t = useTranslations("Events");
  const turnstileRef = useRef<TurnstileInstance>(null);

  const [name, setName] = useState(knownName ?? "");
  const [email, setEmail] = useState("");
  const [joining, setJoining] = useState(false);

  const meta = getEventTypeMeta(info.event_type);
  const closed = ["locked", "drawn", "archived"].includes(info.status);
  const guestReady = name.trim().length > 0 && EMAIL_RE.test(email.trim());
  const canJoin = !joining && !closed && (isRealUser || guestReady);

  const join = async () => {
    setJoining(true);
    try {
      // A guest gets a silent anonymous session; a signed-in visitor keeps the
      // one they have. Either way accept_ss_join runs with a real auth.uid().
      if (!isRealUser) {
        let captchaToken: string | undefined;
        try {
          captchaToken = await turnstileRef.current?.getResponsePromise();
        } catch {
          /* no captcha configured — carry on without one */
        }
        const { error: authError } = await supabase.auth.signInAnonymously({
          options: { captchaToken },
        });
        if (authError) {
          turnstileRef.current?.reset();
          throw authError;
        }
      }

      const { data, error } = await supabase.rpc("accept_ss_join", {
        p_token: token,
        p_display_name: name.trim() || null,
        p_email: email.trim() || null,
      });
      if (error) throw error;

      const res = data as AcceptResult;
      if (!res?.ok) {
        toast.error(
          res?.error === "event_closed"
            ? t("joinErrorClosed")
            : res?.error === "invalid_token"
            ? t("joinErrorInvalid")
            : t("joinErrorGeneric")
        );
        setJoining(false);
        return;
      }

      if (!isRealUser && email.trim() && res.slug) {
        // Attach the address to the anonymous account. Confirming it turns the
        // guest into a permanent user on the SAME uid, so the membership and
        // the name they draw survive a cleared browser or a different device —
        // an anonymous session cannot be resumed anywhere else on its own.
        const { error: linkError } = await supabase.auth.updateUser({
          email: email.trim(),
          data: { display_name: name.trim() },
        });
        if (linkError) {
          // The commonest cause is an address that already has an account.
          // They are in the event either way, so this is information, not a
          // failure — say it once and carry on.
          console.warn("Could not attach email to guest session:", linkError);
          toast(t("joinEmailTaken"), { duration: 6000 });
        }

        // The event's own email, separate from Supabase's confirmation: this
        // is the one that says where the event is. Never block the join on it.
        void sendJoinedEmail(res.slug, email.trim(), name.trim());
      }

      router.push(`/events/${res.slug}`);
    } catch (err) {
      console.error("Join event failed:", err);
      toast.error(t("joinErrorGeneric"));
      setJoining(false);
    }
  };

  return (
    <main className="min-h-screen bg-(--nr-cream) px-4 py-10 md:py-16">
      <div className="mx-auto w-full max-w-[440px]">
        {/* The event introduces itself before it asks for anything. */}
        <section className="nr-card overflow-hidden">
          <div
            className="relative flex min-h-[168px] flex-col items-center justify-center gap-3 bg-(--nr-tile) bg-cover bg-center px-6 py-8 text-center"
            style={
              info.cover_image_url
                ? { backgroundImage: `url('${info.cover_image_url}')` }
                : undefined
            }
          >
            {info.cover_image_url && (
              <div className="absolute inset-0 bg-(--nr-ink)/45" aria-hidden />
            )}
            <div className="relative flex flex-col items-center gap-3">
              <span
                className="grid h-12 w-12 place-items-center rounded-full bg-(--nr-surface) text-2xl shadow-[var(--nr-shadow-hover)]"
                aria-hidden
              >
                {meta.emoji}
              </span>
              <h1
                className={`nr-h2 text-[26px] leading-tight ${
                  info.cover_image_url ? "text-white" : ""
                }`}
              >
                {info.event_name}
              </h1>
              <p
                className={`text-[14px] ${
                  info.cover_image_url
                    ? "text-white/85"
                    : "text-(--nr-gold-strong)"
                }`}
              >
                {info.owner_name
                  ? t("joinInvitedBy", { name: info.owner_name })
                  : t(meta.labelKey)}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 divide-x divide-(--nr-border) border-t border-(--nr-border)">
            <div className="px-5 py-4">
              <dt className="text-[12px] text-(--nr-faint)">
                {t("joinPeopleLabel")}
              </dt>
              <dd className="mt-1 font-heading text-[17px] font-bold text-(--nr-ink)">
                {t("joinPeopleCount", { count: info.member_count })}
              </dd>
            </div>
            <div className="px-5 py-4">
              <dt className="text-[12px] text-(--nr-faint)">
                {meta.showBudget && info.budget != null
                  ? t("fieldBudget")
                  : t("fieldDate")}
              </dt>
              <dd className="mt-1 font-heading text-[17px] font-bold text-(--nr-ink)">
                {meta.showBudget && info.budget != null
                  ? `${info.budget} ${info.currency ?? "EUR"}`
                  : info.event_date
                  ? format.dateTime(new Date(info.event_date), {
                      day: "numeric",
                      month: "long",
                    })
                  : t("joinNoDate")}
              </dd>
            </div>
          </dl>
        </section>

        {closed ? (
          <div className="nr-card mt-4 p-6 text-center">
            <p className="nr-lead text-[16px]">
              {info.status === "drawn"
                ? t("joinClosedDrawn")
                : t("joinClosedLocked")}
            </p>
          </div>
        ) : (
          <section className="nr-card mt-4 p-6">
            {isRealUser ? (
              <p className="mb-5 text-[15px] leading-relaxed text-(--nr-muted)">
                {t("joinSignedInBody")}
              </p>
            ) : (
              <>
                <p className="mb-5 text-[15px] leading-relaxed text-(--nr-muted)">
                  {t("joinGuestBody")}
                </p>

                <label className="mb-4 block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-(--nr-ink)">
                    {t("joinNameLabel")}
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("joinNamePlaceholder")}
                    autoComplete="name"
                    className="w-full rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-cream) px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-(--nr-faint) focus:border-(--nr-yellow-deep)"
                  />
                </label>

                <label className="mb-2 block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-(--nr-ink)">
                    {t("joinEmailLabel")}
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("joinEmailPlaceholder")}
                    autoComplete="email"
                    inputMode="email"
                    className="w-full rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-cream) px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-(--nr-faint) focus:border-(--nr-yellow-deep)"
                  />
                </label>
                <p className="mb-5 text-[13px] leading-relaxed text-(--nr-faint)">
                  {t("joinEmailHelp")}
                </p>

                {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                    options={{ size: "invisible" }}
                  />
                )}
              </>
            )}

            <button
              onClick={join}
              disabled={!canJoin}
              className="nr-btn nr-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {joining ? (
                <span className="loading loading-dots loading-md" />
              ) : (
                t("joinCta")
              )}
            </button>

            {!isRealUser && (
              <p className="mt-4 text-center text-[14px] text-(--nr-muted)">
                {t("joinHaveAccount")}{" "}
                <Link
                  href={`/login?next=${encodeURIComponent(
                    `/events/join/${token}`
                  )}`}
                  className="font-semibold text-(--nr-gold-strong) underline underline-offset-2"
                >
                  {t("joinSignIn")}
                </Link>
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
