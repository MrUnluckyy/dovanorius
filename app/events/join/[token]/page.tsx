import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import type { SsJoinInfo } from "@/types/secret-santa";
import { JoinEventClient } from "./JoinEventClient";

export const metadata: Metadata = {
  title: "Noriuto — kvietimas į renginį",
  robots: { index: false, follow: false },
};

/**
 * Where every invitation lands, whoever clicks it.
 *
 * Deliberately not behind an auth guard. The old flow sent anyone without a
 * session to /login with no `next`, so the destination was lost and they
 * arrived on a dashboard with no idea what they had been invited to. Here the
 * event introduces itself first, and signing in is one of the options rather
 * than the toll gate.
 */
export default async function JoinEventPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const t = await getTranslations("Events");

  const { data: rows } = await supabase.rpc("get_ss_join_info", {
    p_token: token,
  });
  const info = (Array.isArray(rows) ? rows[0] : null) as SsJoinInfo | null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isRealUser = !!user && user.is_anonymous !== true;

  if (!info) {
    return (
      <main className="min-h-screen bg-(--nr-cream) px-4 py-16">
        <div className="nr-card mx-auto max-w-[440px] p-8 text-center">
          <span className="mb-5 inline-grid h-14 w-14 place-items-center rounded-full bg-(--nr-tile) text-2xl">
            🔗
          </span>
          <h1 className="nr-h2 mb-3 text-[26px]">{t("joinDeadTitle")}</h1>
          <p className="nr-lead mb-7 text-[16px]">{t("joinDeadBody")}</p>
          <Link href="/events" className="nr-btn nr-btn-primary w-full">
            {t("joinDeadCta")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <JoinEventClient
      token={token}
      info={info}
      isRealUser={isRealUser}
      knownName={
        isRealUser
          ? (user?.user_metadata?.display_name as string | undefined) ?? null
          : null
      }
    />
  );
}
