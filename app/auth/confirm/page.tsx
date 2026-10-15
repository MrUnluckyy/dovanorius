import { LuMailCheck } from "react-icons/lu";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * The one click between an emailed auth link and spending its token.
 *
 * Exists because mail scanners open links on their own; see the GET handler in
 * app/api/auth/confirm/route.ts. Kept deliberately bare — no navigation, no
 * session lookup — so it renders instantly and has only one thing to press.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const t = await getTranslations("Auth");
  const { token_hash = "", type = "", next = "/" } = await searchParams;

  const kind =
    type === "recovery"
      ? "Recovery"
      : type === "magiclink"
        ? "Login"
        : "Email";

  return (
    <main className="pb-20">
      <section className="nr-container flex min-h-[70vh] items-center justify-center py-12 md:py-20">
        <form
          method="post"
          action="/api/auth/confirm"
          className="nr-card w-full max-w-[480px] p-8 text-center md:p-10"
        >
          <span
            aria-hidden
            className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-(--nr-tile) text-(--nr-gold-strong)"
          >
            <LuMailCheck size={26} />
          </span>

          <h1 className="nr-h2 mb-3 text-[28px] md:text-[34px]">
            {t(`confirm${kind}Title`)}
          </h1>
          <p className="nr-lead mb-8">{t("confirmLead")}</p>

          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next} />

          <button type="submit" className="nr-btn nr-btn-primary w-full">
            {t(`confirm${kind}Cta`)}
          </button>
        </form>
      </section>
    </main>
  );
}
