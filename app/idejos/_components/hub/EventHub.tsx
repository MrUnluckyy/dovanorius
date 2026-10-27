"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { LuArrowLeft, LuX } from "react-icons/lu";
import type { EventEntry } from "@/lib/discover/eventEntry.server";
import { dative, genitive } from "@/lib/discover/ltName";
import { formatPrice } from "@/lib/discover/format";
import { formatEventDate } from "@/lib/events/formatEventDate";
import { AvatarImg } from "@/components/AvatarImg";
import { trackDiscover, trackInspo } from "@/utils/trackInspo";
import { CATEGORIES } from "../filters";
import type { CardProduct } from "../ProductCard";
import { ProductModal } from "../ProductModal";
import { IdeasGrid } from "../IdeasGrid";

/** Interest chips until products carry interest tags (T8): giftable categories. */
const INTERESTS = ["beauty", "home", "kitchen", "tech", "sport", "toys", "tools", "garden", "pets", "accessory"];

type Audience = "her" | "him" | null;

/**
 * Discover for a Secret Santa giver (state 4): who they are buying for, that
 * person's own wishes within the budget, then ideas narrowed by budget, Jai /
 * Jam and an interest. The giver's own profile plays no part here.
 *
 * Choices live in the URL (?kam=jai&cat=tech), not in browser storage: they
 * survive Back and a shared link, and the app can read the same parameters.
 */
export function EventHub({ entry, accountId }: { entry: EventEntry; accountId: string | null }) {
  const t = useTranslations("Discover.event");
  const tc = useTranslations("Discover");
  const locale = useLocale();

  const [audience, setAudience] = useState<Audience>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<CardProduct | null>(null);

  // Read the URL once on mount, write it on every change.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const kam = p.get("kam");
    setAudience(kam === "jai" ? "her" : kam === "jam" ? "him" : null);
    const cat = p.get("cat");
    setCategory(cat && INTERESTS.includes(cat) ? cat : null);
    trackDiscover("discover_view", { page: "inspire", state: "4" });
  }, []);

  const sync = (next: { audience?: Audience; category?: string | null }) => {
    const a = next.audience !== undefined ? next.audience : audience;
    const c = next.category !== undefined ? next.category : category;
    setAudience(a);
    setCategory(c);
    const p = new URLSearchParams(window.location.search);
    if (a) p.set("kam", a === "her" ? "jai" : "jam");
    else p.delete("kam");
    if (c) p.set("cat", c);
    else p.delete("cat");
    window.history.replaceState(null, "", `/idejos?${p.toString()}`);
  };

  const name = entry.receiver.firstName;
  const nameDat = name ? dative(name) : null;
  const nameGen = name ? genitive(name) : null;
  const date = formatEventDate(entry.eventDate, locale);
  const budget = entry.budget;

  const ideasTitle =
    nameDat && budget ? t("ideasForBudget", { name: nameDat, budget })
    : nameDat ? t("ideasFor", { name: nameDat })
    : budget ? t("ideasBudget", { budget })
    : t("ideas");

  const chip = (on: boolean) =>
    `inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[14px] font-semibold transition-colors ${
      on
        ? "border-(--nr-ink) bg-(--nr-ink) text-(--nr-cream)"
        : "border-(--nr-ink)/15 text-(--nr-ink) hover:border-(--nr-ink)"
    }`;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-6 sm:px-6">
      <div className="pt-6 sm:pt-8">
        <Link
          href={`/renginiai/${entry.slug}`}
          className="inline-flex items-center gap-1.5 text-[14px] text-(--nr-muted) hover:text-(--nr-ink)"
        >
          <LuArrowLeft className="w-4" aria-hidden /> {t("back", { event: entry.name })}
        </Link>
      </div>

      {/* ---------- Who this is for ---------- */}
      <header className="flex flex-col gap-5 pb-10 pt-6 sm:flex-row sm:items-center sm:gap-7 sm:pb-12">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-(--nr-stage-2) sm:h-24 sm:w-24">
          <AvatarImg
            src={entry.receiver.avatarUrl}
            alt=""
            fallback={
              <div className="grid h-full w-full place-items-center text-3xl font-semibold text-(--nr-ink)">
                {(name ?? "?").charAt(0).toUpperCase()}
              </div>
            }
          />
        </div>
        <div className="min-w-0">
          <h1 className="font-heading text-[34px] font-extrabold leading-[1.02] tracking-[-0.035em] text-(--nr-ink) sm:text-[48px]">
            {nameDat ? t("givingTo", { name: nameDat }) : t("givingToPlain", { name: entry.receiver.displayName ?? "?" })}
          </h1>
          <p className="mt-2 text-[15px] text-(--nr-muted)">
            {[entry.name, budget ? t("budget", { budget }) : null, date].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      <div className="space-y-14 sm:space-y-20">
        {/* ---------- Their own words and wishes ---------- */}
        {(entry.wants || entry.wishes.length > 0) && (
          <section>
            <h2 className="mb-4 font-heading text-[22px] font-bold tracking-[-0.02em] text-(--nr-ink) sm:text-[26px]">
              {nameGen ? t("wishesOf", { name: nameGen }) : t("wishes")}
            </h2>
            {entry.wants && (
              <blockquote className="mb-6 max-w-[60ch] whitespace-pre-line rounded-xl bg-(--nr-stage) px-5 py-4 text-[15px] leading-relaxed text-(--nr-ink)">
                {entry.wants}
              </blockquote>
            )}
            {entry.wishes.length > 0 && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-6">
                {entry.wishes.map((w) => (
                  <Link key={w.id} href={w.href} className="group flex flex-col rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-(--nr-ink) focus-visible:ring-offset-4 focus-visible:ring-offset-(--nr-cream)">
                    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-(--nr-stage)">
                      {w.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={w.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain p-[9%] mix-blend-multiply" />
                      )}
                    </div>
                    <h3 className="mt-2.5 line-clamp-2 text-[13px] leading-[1.35] text-(--nr-ink)">{w.title}</h3>
                    {w.price != null && (
                      <span className="mt-1 text-[14px] font-semibold tabular-nums text-(--nr-ink)">{formatPrice(w.price)}</span>
                    )}
                    <span className="mt-2 w-fit text-[13px] font-semibold text-(--nr-ink) underline decoration-(--nr-border) decoration-2 underline-offset-[5px] group-hover:decoration-(--nr-ink)">
                      {t("reserve")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ---------- Narrow the ideas ---------- */}
        <section>
          <h2 className="mb-4 font-heading text-[22px] font-bold tracking-[-0.02em] text-(--nr-ink) sm:text-[26px]">
            {name ? t("interestsOf", { name }) : t("interests")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {(["her", "him"] as const).map((a) => (
              <button key={a} type="button" aria-pressed={audience === a} onClick={() => sync({ audience: audience === a ? null : a })} className={chip(audience === a)}>
                {t(a === "her" ? "forHer" : "forHim")}
              </button>
            ))}
            <span className="mx-1 hidden w-px self-stretch bg-(--nr-border) sm:block" aria-hidden />
            {CATEGORIES.filter((c) => INTERESTS.includes(c.type)).map((c) => (
              <button key={c.type} type="button" aria-pressed={category === c.type} onClick={() => sync({ category: category === c.type ? null : c.type })} className={chip(category === c.type)}>
                <c.Icon className="w-4" aria-hidden />
                {tc(`category.${c.key}`)}
              </button>
            ))}
          </div>
        </section>

        {/* ---------- Ideas ---------- */}
        <div>
          {(audience || category) && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px]">
              {audience && (
                <button type="button" onClick={() => sync({ audience: null })} className="inline-flex items-center gap-1 rounded-full bg-(--nr-stage) px-3 py-1.5 font-semibold text-(--nr-ink)">
                  {t(audience === "her" ? "forHer" : "forHim")} <LuX className="w-3.5" aria-label={t("remove")} />
                </button>
              )}
              {category && (
                <button type="button" onClick={() => sync({ category: null })} className="inline-flex items-center gap-1 rounded-full bg-(--nr-stage) px-3 py-1.5 font-semibold text-(--nr-ink)">
                  {tc(`category.${category}`)} <LuX className="w-3.5" aria-label={t("remove")} />
                </button>
              )}
            </div>
          )}
          <IdeasGrid
            title={ideasTitle}
            audience={audience ?? "everyone"}
            productType={category}
            productTypes={category ? undefined : INTERESTS}
            priceMax={budget}
            onOpen={(p) => {
              setSelected(p);
              trackInspo("open", p.id, { page: "inspire", state: "4", surface: "grid" });
            }}
          />
        </div>

        <p className="text-center text-[14px] text-(--nr-muted)">
          {t("forYourself")}{" "}
          <Link href="/idejos" className="font-semibold text-(--nr-ink) underline underline-offset-4">
            {t("forYourselfLink")}
          </Link>
        </p>
      </div>

      <ProductModal product={selected} userId={accountId} onClose={() => setSelected(null)} />
    </div>
  );
}
