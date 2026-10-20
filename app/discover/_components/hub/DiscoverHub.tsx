"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import {
  useAllPersonaPicks,
  usePersonas,
  type GiftPersona,
  type PersonaPick,
} from "@/hooks/usePersonas";
import {
  useRankedCollections,
  type RankedCollection,
} from "@/hooks/useRankedCollections";
import {
  recipientLens,
  type RecipientKey,
  type VisitorGender,
} from "@/lib/discover/recipients";
import {
  NAV_RECIPIENTS,
  categoriesFor,
  collectionHref,
  discoverHref,
} from "@/lib/discover/routes";
import type { Visitor } from "@/lib/discover/visitorState";
import type { StoryArticle } from "@/lib/discover/articles";
import type { Placement } from "@/lib/discover/placements";
import { useMyCategories } from "@/hooks/useMyCategories";
import { trackDiscover, trackInspo, type TrackContext } from "@/utils/trackInspo";
import { toCardProduct } from "../CollectionRow";
import type { CardProduct } from "../ProductCard";
import { ProductModal } from "../ProductModal";
import { IdeasGrid } from "../IdeasGrid";
import { Rail } from "./Rail";
import { StillLife } from "./StillLife";
import { StoryBlock, type Story } from "./StoryBlock";

const APPAREL = new Set(["clothing", "shoes", "bag"]);

/** How many ranked collections lead a page before "Visos kolekcijos". */
const TOP = 4;

const toCards = (picks: PersonaPick[]): CardProduct[] =>
  picks.map((p) => ({ ...toCardProduct(p), reason: null }));

/**
 * One discover page: the home ("Kam ieškai dovanos?"), a recipient hub
 * ("Dovanos moteriai") or a category inside it. Routing and the visitor's
 * state are resolved on the server; this composes the page from the curated
 * picks (one request for every shelf), the ranked collections and the grid.
 *
 * Order, top to bottom: title → lead row → category tiles → ranked
 * collections, with a sponsored placement (if any) after the second and the
 * gift guide after the fourth → the grid.
 */
export function DiscoverHub({
  visitor,
  userId,
  recipient,
  category,
  article,
  ad,
}: {
  visitor: Visitor;
  userId: string | null;
  recipient: RecipientKey | null;
  category: string | null;
  article: StoryArticle | null;
  /** The one sponsored placement for this page, if any. */
  ad: Placement | null;
}) {
  const t = useTranslations("Discover");
  const supabase = createClient();
  const accountId = visitor.isAccount ? userId : null;

  const [gender, setGender] = useState<VisitorGender>(visitor.gender);
  const [genderDeclined, setGenderDeclined] = useState(false);
  const [selected, setSelected] = useState<CardProduct | null>(null);
  const [showAll, setShowAll] = useState(false);

  const lens = recipientLens(recipient, gender);
  const { data: personas } = usePersonas();
  const { data: picksById, isLoading: picksLoading } = useAllPersonaPicks();

  const bySlug = useMemo(
    () => new Map((personas ?? []).map((p) => [p.slug, p])),
    [personas]
  );
  const picksOf = (p: GiftPersona | undefined) => (p && picksById?.[p.id]) || [];
  // Narrow any pick list to this page: its category, and away from products
  // explicitly made for the other gender (a beard kit has no place on
  // "Moteriai", even inside a unisex beauty collection).
  const inCategory = (picks: PersonaPick[]) =>
    picks.filter(
      (p) =>
        (!category || p.product_type === category) &&
        !(lens.audience === "her" && p.gender === "male") &&
        !(lens.audience === "him" && p.gender === "female")
    );

  // ---- lead row: the recipient's own curated picks -------------------------
  const leadPicks = inCategory(lens.personas.flatMap((s) => picksOf(bySlug.get(s))));

  // ---- ranked collections, narrowed to the category when there is one ------
  const { data: ranked, isLoading: rankLoading } = useRankedCollections(
    lens.personas[0] ?? null,
    lens.audience,
    true
  );
  const shelves = useMemo(() => {
    const themes = new Map(
      (personas ?? [])
        .filter((p) => p.kind === "theme" || p.kind === "editorial")
        .map((p) => [p.id, p])
    );
    const order: { persona: GiftPersona; rank: RankedCollection | null }[] = ranked
      ? ranked.flatMap((r) => {
          const persona = themes.get(r.persona_id);
          return persona ? [{ persona, rank: r }] : [];
        })
      : [...themes.values()].map((persona) => ({ persona, rank: null }));
    return order
      .map((s) => ({ ...s, items: toCards(inCategory(picksById?.[s.persona.id] ?? [])) }))
      // A rail narrowed to a category must still look like a row.
      .filter((s) => s.items.length >= 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranked, personas, picksById, category, lens.audience]);

  // On a category page the order is already narrowed, so show what qualifies;
  // elsewhere the ranking's own top slots lead.
  const top = category ? shelves.slice(0, TOP) : shelves.filter((s) => s.rank?.is_top ?? true).slice(0, TOP);
  const rest = shelves.filter((s) => !top.includes(s));

  const reasonText = (r: RankedCollection | null): string | null => {
    if (!r?.reason) return null;
    if (r.reason === "behaviour" && r.reason_detail) {
      return t("collectionReason.behaviour", { category: t(`category.${r.reason_detail}`) });
    }
    // "Pagal pasirinktą gavėją" / "Gali patikti" under every rail on a page
    // that already says who it is for is noise; only specific reasons earn a line.
    if (r.reason === "explore") return t("collectionReason.explore");
    return null;
  };

  // ---- category tiles: on "Sau", what the visitor actually opens comes first
  const { data: myTypes = [] } = useMyCategories(recipient === "self" && !!userId);
  const orderedCategories = useMemo(() => {
    const base = recipient ? categoriesFor(recipient, gender) : [];
    if (recipient !== "self" || !myTypes.length) return base;
    const rank = (c: string) => (myTypes.includes(c) ? myTypes.indexOf(c) : 99);
    return [...base].sort((a, b) => rank(a) - rank(b));
  }, [recipient, gender, myTypes]);

  // ---- still-life images ---------------------------------------------------
  const imagesFrom = (picks: PersonaPick[]) =>
    picks.map((p) => p.image_url).filter((u): u is string => !!u).slice(0, 3);

  const recipientImages = (key: RecipientKey) => {
    const slugs = recipientLens(key, gender).personas;
    const picks = slugs.flatMap((s) => picksOf(bySlug.get(s)));
    // Couple and neutral "Sau" have no persona: borrow from broad collections.
    return imagesFrom(
      picks.length ? picks : ["small-things", "cosy-home", "tech-lover"].flatMap((s) => picksOf(bySlug.get(s)).slice(0, 1))
    );
  };

  const categoryImages = (cat: string) => {
    const own = lens.personas.flatMap((s) => picksOf(bySlug.get(s)));
    // Children's pages never borrow from adult collections: candles on a
    // "Vaikui" tile read as a mistake. Adult pages may fill gaps from any shelf.
    const sensitive = recipient === "kid" || recipient === "teen" || recipient === "baby";
    const pool = sensitive ? own : [...own, ...Object.values(picksById ?? {}).flat()];
    const seen = new Set<string>();
    return imagesFrom(
      pool.filter((p) => p.product_type === cat && !seen.has(p.id) && seen.add(p.id))
    );
  };

  // Categories with nothing curated yet are left out (an empty stack reads as
  // broken), and the next ones move up so the row stays full.
  const tileCategories = picksLoading
    ? orderedCategories.slice(0, 6)
    : orderedCategories.filter((c) => categoryImages(c).length > 0).slice(0, 6);

  // ---- side effects --------------------------------------------------------
  useEffect(() => {
    trackDiscover("discover_view", {
      page: "inspire",
      state: visitor.state,
      ...(recipient ? { recipient } : {}),
      ...(category ? { shelf: `category:${category}` } : {}),
    });
    // Remembered for next time: /discover reopens on this recipient.
    if (recipient && userId && recipient !== visitor.recipient) {
      // .then() is what sends it: supabase-js builders are lazy, and a bare
      // `void builder` never leaves the browser.
      supabase.from("profiles").update({ last_recipient: recipient }).eq("id", userId).then(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipient, category]);

  const answerGender = (g: "female" | "male" | null) => {
    trackDiscover("nudge_answered", {
      page: "inspire",
      state: visitor.state,
      question: "gender",
      answer: g ?? "declined",
    });
    if (!g) return setGenderDeclined(true);
    setGender(g);
    if (userId) supabase.from("profiles").update({ gender: g }).eq("id", userId).then(() => {});
  };

  const open = (context: TrackContext) => (p: CardProduct) => {
    setSelected(p);
    trackInspo("open", p.id, { page: "inspire", state: visitor.state, ...context });
  };

  // ---- copy ----------------------------------------------------------------
  const recipientLabel = recipient ? t(`recipient.${recipient}`) : null;
  const title = !recipient
    ? t("hub.homeTitle")
    : category
      ? t(`category.${category}`)
      : t("hub.recipientTitle", { recipient: recipientLabel!.toLocaleLowerCase("lt") });

  const profileText = [
    gender === "female" ? t("firstView.profileFemale") : gender === "male" ? t("firstView.profileMale") : null,
    visitor.ageBand ? t("firstView.profileAge", { band: visitor.ageBand.replace("-", "–") }) : null,
  ]
    .filter(Boolean)
    .join(", ");

  const isSelf = recipient === "self";
  const leadTitle = isSelf
    ? visitor.state === "3" ? t("firstView.picked") : t("firstView.mayLike")
    : t("hub.ourPicks");
  const leadReason = isSelf && profileText ? t("firstView.pickedReason", { profile: profileText }) : null;

  // Six products under the guide: deeper picks for this recipient when there
  // are enough, otherwise the second half of a collection already on the page.
  const storyProducts =
    leadPicks.length >= 18
      ? toCards(leadPicks.slice(12, 18))
      : (top[1]?.items ?? top[0]?.items ?? []).slice(6, 12);

  const guide: Story | null = article && {
    kind: "guide",
    label: t("hub.guide"),
    title: article.title,
    excerpt: article.excerpt,
    image: article.image,
    imageAlt: article.imageAlt,
    href: `/blog/${article.slug}`,
    ctaLabel: t("hub.readGuide"),
  };
  const guideBlock = guide && (
    <StoryBlock story={guide} products={storyProducts} onOpen={open({ surface: "story" })} />
  );
  const adBlock = ad && (
    <StoryBlock
      story={{
        kind: "sponsored",
        label: t("hub.sponsored", { advertiser: ad.advertiser }),
        title: ad.headline,
        excerpt: ad.body,
        image: ad.imageUrl,
        imageAlt: null,
        href: ad.ctaUrl,
        ctaLabel: ad.ctaLabel,
        placementId: ad.id,
      }}
      products={ad.products.map(toCardProduct)}
      onOpen={open({ surface: "sponsored", placement: ad.id })}
    />
  );
  // The ad, when there is one, takes the first slot; the guide moves down.
  const slotA = adBlock ?? guideBlock;
  const slotB = adBlock ? guideBlock : null;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-6 sm:px-6">
      {/* ---------- Title ---------- */}
      <header className="pb-8 pt-8 sm:pb-10 sm:pt-12">
        {category && recipient && (
          <Link
            href={discoverHref(recipient)}
            className="mb-2 inline-block text-[14px] text-(--nr-muted) hover:text-(--nr-ink)"
          >
            {t("hub.recipientTitle", { recipient: recipientLabel!.toLocaleLowerCase("lt") })}
          </Link>
        )}
        <h1 className="font-heading text-[34px] font-extrabold leading-[1.02] tracking-[-0.035em] text-(--nr-ink) sm:text-[52px]">
          {visitor.greetingName && isSelf && !category
            ? t("firstView.greeting", { name: visitor.greetingName })
            : title}
        </h1>
        {!recipient && <p className="mt-3 max-w-[46ch] text-[16px] text-(--nr-muted)">{t("hub.homeLead")}</p>}
        {isSelf && !category && visitor.greetingName && (
          <p className="mt-3 text-[16px] text-(--nr-muted)">{t("firstView.todayPrompt")}</p>
        )}
      </header>

      <div className="space-y-14 sm:space-y-20">
        {/* ---------- Home: who is it for ---------- */}
        {!recipient && (
          <section aria-label={t("hub.recipientsNav")}>
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4">
              {NAV_RECIPIENTS.map((key) => (
                <StillLife
                  key={key}
                  href={discoverHref(key)}
                  label={t(`recipient.${key}`)}
                  images={picksLoading ? [] : recipientImages(key)}
                  loading={picksLoading}
                />
              ))}
            </div>
          </section>
        )}

        {/* ---------- "Sau" without a gender: one quiet question ---------- */}
        {isSelf && !gender && !genderDeclined && (
          <section className="max-w-xl">
            <h2 className="font-heading text-[22px] font-bold tracking-[-0.02em] text-(--nr-ink)">
              {t("firstView.selfGenderPrompt")}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["female", "male", null] as const).map((g) => (
                <button
                  key={g ?? "none"}
                  type="button"
                  onClick={() => answerGender(g)}
                  className="min-h-11 cursor-pointer rounded-full border border-(--nr-ink)/15 px-5 text-[15px] font-semibold text-(--nr-ink) transition-colors hover:border-(--nr-ink) hover:bg-(--nr-ink) hover:text-(--nr-cream)"
                >
                  {t(g === "female" ? "firstView.genderFemale" : g === "male" ? "firstView.genderMale" : "firstView.genderNone")}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-(--nr-faint)">{t("firstView.onlyYou")}</p>
          </section>
        )}

        {/* ---------- Lead row ---------- */}
        {recipient && (picksLoading || leadPicks.length >= 4) && (
          <Rail
            title={leadTitle}
            reason={leadReason}
            items={toCards(leadPicks.slice(0, 12))}
            isLoading={picksLoading}
            onOpen={open({ surface: "lead" })}
          />
        )}

        {/* ---------- Category tiles (recipient root only) ---------- */}
        {recipient && !category && tileCategories.length > 0 && (
          <section>
            <h2 className="mb-4 font-heading text-[22px] font-bold tracking-[-0.02em] text-(--nr-ink) sm:text-[26px]">
              {t("hub.categories")}
            </h2>
            <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-6 sm:gap-x-4">
              {tileCategories.map((c) => (
                  <StillLife
                    key={c}
                    size="sm"
                    href={discoverHref(recipient, c)}
                    label={t(`category.${c}`)}
                    images={picksLoading ? [] : categoryImages(c)}
                    loading={picksLoading}
                  />
                ))}
            </div>
          </section>
        )}

        {/* ---------- Ranked collections, story after the second ---------- */}
        {rankLoading || picksLoading ? (
          <Rail title="" items={[]} isLoading onOpen={() => {}} />
        ) : (
          top.map((s, i) => (
            <div key={s.persona.id} className="space-y-14 sm:space-y-20">
              <Rail
                title={s.persona.label_lt}
                reason={reasonText(s.rank)}
                href={collectionHref(s.persona.slug)}
                items={s.items.slice(0, 12)}
                onOpen={open({ surface: "shelf", shelf: s.persona.slug })}
              />
              {i === 1 && slotA}
              {i === 3 && slotB}
            </div>
          ))
        )}
        {/* Pages with fewer collections still get both slots, before the
            grid; not while loading, or the blocks would jump once rails land. */}
        {!rankLoading && !picksLoading && top.length < 2 && slotA}
        {!rankLoading && !picksLoading && top.length < 4 && slotB}

        {rest.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              className="cursor-pointer text-[15px] font-semibold text-(--nr-ink) underline decoration-(--nr-border) decoration-2 underline-offset-[6px] hover:decoration-(--nr-ink)"
            >
              {showAll ? t("hideCollections") : t("allCollections", { count: rest.length })}
            </button>
            {showAll && (
              <div className="mt-14 space-y-14 sm:space-y-20">
                {rest.map((s) => (
                  <Rail
                    key={s.persona.id}
                    title={s.persona.label_lt}
                    reason={reasonText(s.rank)}
                    href={collectionHref(s.persona.slug)}
                    items={s.items.slice(0, 12)}
                    onOpen={open({ surface: "shelf", shelf: s.persona.slug })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------- The grid ---------- */}
        <IdeasGrid
          title={category ? t("hub.allInCategory") : recipient ? t("hub.allIdeas") : t("firstView.moreIdeas")}
          audience={lens.audience}
          productType={category ?? lens.gridType}
          // A recipient page's grid stays inside that recipient's gift
          // categories, minus apparel: default browse is mostly fashion, and
          // a page called "Dovanos moteriai" should not open on cycling shorts.
          productTypes={recipient ? categoriesFor(recipient, gender).filter((c) => !APPAREL.has(c)) : undefined}
          onOpen={open({ surface: "grid" })}
        />

        {isSelf && profileText && (
          <p className="text-center text-[13px] text-(--nr-muted)">
            {t("firstView.shownFor", { profile: profileText })}{" "}
            <Link href="/dashboard" className="font-semibold text-(--nr-ink) underline underline-offset-4">
              {t("firstView.change")}
            </Link>
          </p>
        )}

        <p className="text-center text-[12px] text-(--nr-faint)">{t("affiliateDisclosure")}</p>
      </div>

      <ProductModal product={selected} userId={accountId} onClose={() => setSelected(null)} />
    </div>
  );
}
