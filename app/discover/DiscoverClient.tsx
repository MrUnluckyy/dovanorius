"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LuSearch, LuSparkles } from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { useGiftIdeas } from "@/hooks/useGiftIdeas";
import {
  useRankedCollections,
  type RankedCollection,
} from "@/hooks/useRankedCollections";
import { useMyCategories } from "@/hooks/useMyCategories";
import { usePersonas, type GiftPersona } from "@/hooks/usePersonas";
import {
  recipientLens,
  type PartnerGender,
  type RecipientKey,
  type VisitorGender,
} from "@/lib/discover/recipients";
import type { Visitor } from "@/lib/discover/visitorState";
import { trackInspo, trackDiscover, type TrackContext } from "@/utils/trackInspo";

import { type CardProduct } from "./_components/ProductCard";
import { CATEGORIES, browseHref } from "./_components/filters";
import { PersonaShelf } from "./_components/PersonaShelf";
import { ProductStrip } from "./_components/ProductStrip";
import { ProductModal } from "./_components/ProductModal";
import { RecipientChips, RecipientTiles } from "./_components/RecipientPicker";
import { ForYouBlock } from "./_components/ForYouBlock";
import { IdeasGrid } from "./_components/IdeasGrid";

/**
 * /discover, first view per visitor (dev-issue-discover-premium 4.1-4.5).
 *
 *   1  nothing known   "Kam ieškai dovanos?" + eight recipient tiles
 *   2  gender known    greeting, recipient chips (Sau first), "Tau gali patikti"
 *   3  gender + age    chips, "Atrinkta tau", "Tavo kategorijos", "Rodoma pagal"
 *
 * The state comes resolved from the server (page.tsx). A recipient choice
 * narrows the whole page: the lead shelves, the ranked collections and the
 * grid. The age row and the nudge card are T3; state 4 (from an event) is T4.
 */
export function DiscoverClient({
  visitor,
  userId,
}: {
  visitor: Visitor;
  /** Any session, guest included: who last_recipient is written for. */
  userId: string | null;
}) {
  const t = useTranslations("Discover");
  const router = useRouter();
  const supabase = createClient();

  // Only a real account can save; guests browse (see utils/auth/account).
  const accountId = visitor.isAccount ? userId : null;

  const [recipient, setRecipient] = useState<RecipientKey | null>(visitor.recipient);
  const [partner, setPartner] = useState<PartnerGender>(null);
  // State 1 visitors can say who they are when they tap "Sau"; it applies at
  // once and is saved for anyone with a session.
  const [gender, setGender] = useState<VisitorGender>(visitor.gender);
  const [genderDeclined, setGenderDeclined] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<CardProduct | null>(null);
  const [showAllShelves, setShowAllShelves] = useState(false);

  const lens = recipientLens(recipient, gender, partner);

  const { data: personas } = usePersonas();
  const personaBySlug = useMemo(
    () => new Map((personas ?? []).map((p) => [p.slug, p])),
    [personas]
  );
  const themes =
    personas?.filter((p) => p.kind === "theme" || p.kind === "editorial") ?? [];
  const leadPersonas = lens.personas
    .map((s) => personaBySlug.get(s))
    .filter((p): p is GiftPersona => !!p);

  // Ranked collections (T0) follow the chosen recipient.
  const { data: ranked, isLoading: rankLoading } = useRankedCollections(
    lens.personas[0] ?? null,
    lens.audience,
    true
  );
  const themeById = new Map(themes.map((p) => [p.id, p]));
  const rankedShelves = ranked
    ? ranked.flatMap((r) => {
        const persona = themeById.get(r.persona_id);
        return persona ? [{ persona, rank: r }] : [];
      })
    : null;
  // No ranking (RPC failed): the old fixed order, all shown.
  const topShelves = rankedShelves
    ? rankedShelves.filter((s) => s.rank.is_top)
    : themes.map((persona) => ({ persona, rank: null }));
  const restShelves = rankedShelves ? rankedShelves.filter((s) => !s.rank.is_top) : [];

  const reasonText = (r: RankedCollection | null): string | null => {
    if (!r?.reason) return null;
    if (r.reason === "behaviour") {
      return CATEGORIES.some((c) => c.type === r.reason_detail)
        ? t("collectionReason.behaviour", { category: t(`category.${r.reason_detail}`) })
        : null;
    }
    if (r.reason === "recipient" || r.reason === "prior" || r.reason === "explore") {
      return t(`collectionReason.${r.reason}`);
    }
    return null;
  };

  // State 3: categories the visitor actually engages with come first.
  const { data: myTypes = [] } = useMyCategories(visitor.state === "3" && !!userId);
  const orderedCategories = useMemo(() => {
    if (!myTypes.length) return CATEGORIES;
    const rank = (type: string) => {
      const i = myTypes.indexOf(type);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...CATEGORIES].sort((a, b) => rank(a.type) - rank(b.type));
  }, [myTypes]);

  // AI "we suggest" strip: accounts only (LLM cost), shopping for themselves.
  const { data: aiData, isLoading: aiLoading } = useGiftIdeas(
    recipient === "self" ? accountId : null,
    "any",
    null,
    null
  );
  const aiIdeas: CardProduct[] = (aiData?.ideas ?? []).map((i) => ({
    id: i.product_id,
    title: i.title,
    price: i.price,
    imageUrl: i.image_url,
    deepLink: i.deep_link,
    reason: i.reason,
  }));

  useEffect(() => {
    trackDiscover("discover_view", {
      page: "inspire",
      state: visitor.state,
      ...(visitor.recipient ? { recipient: visitor.recipient } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseRecipient = (key: RecipientKey | null) => {
    setRecipient(key);
    setPartner(null);
    setShowAllShelves(false);
    if (!key) return;
    trackDiscover("recipient_selected", {
      page: "inspire",
      state: visitor.state,
      recipient: key,
    });
    // Preselected next visit. Fire-and-forget: a failed write must never
    // block browsing.
    if (userId) {
      void supabase.from("profiles").update({ last_recipient: key }).eq("id", userId);
    }
  };

  const answerGender = (g: "female" | "male" | null) => {
    trackDiscover("nudge_answered", {
      page: "inspire",
      state: visitor.state,
      question: "gender",
      answer: g ?? "declined",
    });
    if (!g) {
      setGenderDeclined(true);
      return;
    }
    setGender(g);
    if (userId) {
      void supabase.from("profiles").update({ gender: g }).eq("id", userId);
    }
  };

  const openProduct = (p: CardProduct, context?: TrackContext) => {
    setSelected(p);
    trackInspo("open", p.id, { page: "inspire", state: visitor.state, ...context });
  };
  const openFromShelf = (slug: string) => (p: CardProduct) =>
    openProduct(p, { surface: "shelf", shelf: slug });

  const profileText = [
    gender === "female" ? t("firstView.profileFemale") : gender === "male" ? t("firstView.profileMale") : null,
    visitor.ageBand ? t("firstView.profileAge", { band: visitor.ageBand.replace("-", "–") }) : null,
  ]
    .filter(Boolean)
    .join(", ");

  const selfPersona =
    recipient === "self" && leadPersonas.length === 1 ? leadPersonas[0] : null;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-6 sm:px-6 sm:pt-8">
      {/* ---------- Header per state ---------- */}
      {visitor.state === "1" ? (
        <header className="mb-4">
          <h1 className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            {t("firstView.askTitle")}
          </h1>
          <p className="mt-1 text-[15px] opacity-60">{t("firstView.askLead")}</p>
        </header>
      ) : visitor.state === "2" ? (
        <header className="mb-3">
          <h1 className="font-heading text-3xl font-extrabold leading-tight tracking-tight">
            {visitor.greetingName
              ? t("firstView.greeting", { name: visitor.greetingName })
              : t("firstView.greetingNoName")}
          </h1>
          <p className="mt-1 text-[15px] opacity-60">{t("firstView.todayPrompt")}</p>
        </header>
      ) : (
        <h1 className="sr-only">{t("title")}</h1>
      )}

      {/* ---------- Recipients ---------- */}
      <div className="mb-5">
        {visitor.state === "1" ? (
          <RecipientTiles selected={recipient} onSelect={chooseRecipient} />
        ) : (
          <RecipientChips
            selected={recipient}
            partner={partner}
            onSelect={chooseRecipient}
            onPartner={setPartner}
          />
        )}
      </div>

      {/* "Sau" with no gender known: the one place the question is obviously
          useful (4.3). Inline, one tap, applies at once. */}
      {recipient === "self" && !gender && !genderDeclined && (
        <div className="mb-5 rounded-3xl bg-primary/20 p-4">
          <p className="font-semibold">{t("firstView.selfGenderPrompt")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["female", "male", null] as const).map((g) => (
              <button
                key={g ?? "none"}
                type="button"
                onClick={() => answerGender(g)}
                className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-base-300 bg-base-100 px-4 text-sm font-semibold hover:border-base-content/30"
              >
                {t(g === "female" ? "firstView.genderFemale" : g === "male" ? "firstView.genderMale" : "firstView.genderNone")}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs opacity-60">{t("firstView.onlyYou")}</p>
        </div>
      )}

      {/* Search stays reachable: someone who already knows what they want
          should not have to scroll for it. Submitting goes to browse. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = searchInput.trim();
          if (!q) return;
          router.push(browseHref({ q }));
        }}
        className="mb-5"
      >
        <label className="input flex w-full items-center gap-2 rounded-full sm:max-w-md">
          <LuSearch className="w-4 opacity-50" aria-hidden />
          <input
            type="search"
            className="grow"
            placeholder={t("searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label={t("searchPlaceholder")}
          />
        </label>
      </form>

      <div className="space-y-6">
        {/* ---------- Lead block: who this is for ---------- */}
        {selfPersona ? (
          visitor.state === "3" ? (
            <ForYouBlock
              persona={selfPersona}
              variant="grid4"
              title={t("firstView.picked")}
              subtitle={profileText ? t("firstView.pickedReason", { profile: profileText }) : undefined}
              onOpen={openFromShelf(selfPersona.slug)}
            />
          ) : (
            <ForYouBlock
              persona={selfPersona}
              variant="strip"
              title={t("firstView.mayLike")}
              onOpen={openFromShelf(selfPersona.slug)}
            />
          )
        ) : (
          leadPersonas.map((p) => (
            <PersonaShelf key={p.id} persona={p} onOpen={openFromShelf(p.slug)} />
          ))
        )}

        {recipient === "self" && accountId && (aiLoading || aiIdeas.length > 0) && (
          <ProductStrip
            title={t("collections.weSuggest")}
            subtitle={t("collections.weSuggestSubtitle")}
            Icon={LuSparkles}
            items={aiIdeas}
            isLoading={aiLoading}
            onOpen={(p) => openProduct(p, { surface: "ai" })}
          />
        )}

        {/* ---------- Categories ---------- */}
        {visitor.state === "2" ? (
          <section>
            <h2 className="mb-2.5 font-heading text-lg font-bold">{t("firstView.categoriesTiles")}</h2>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              {CATEGORIES.slice(0, 6).map((c) => (
                <Link
                  key={c.type}
                  href={browseHref({ type: c.type })}
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-base-200 px-2 py-4 text-center transition hover:bg-base-300"
                >
                  <c.Icon className="h-6 w-6 opacity-70" aria-hidden />
                  <span className="text-[13px] font-semibold">{t(`category.${c.key}`)}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section>
            <h2 className="mb-2.5 font-heading text-lg font-bold">
              {visitor.state === "3" ? t("firstView.yourCategories") : t("firstView.categoriesChips")}
            </h2>
            <div
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
            >
              {orderedCategories.map((c) => (
                <Link
                  key={c.type}
                  href={browseHref({ type: c.type })}
                  className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-base-300 bg-base-100 px-4 text-sm font-semibold transition hover:border-base-content/30"
                >
                  <c.Icon className="w-4 shrink-0" aria-hidden />
                  {t(`category.${c.key}`)}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ---------- Ranked collections (T0) ---------- */}
        {rankLoading ? (
          <div className="nr-skeleton h-72 w-full rounded-3xl" />
        ) : (
          topShelves.map(({ persona, rank }) => (
            <PersonaShelf
              key={persona.id}
              persona={persona}
              reason={reasonText(rank)}
              onOpen={openFromShelf(persona.slug)}
            />
          ))
        )}

        {restShelves.length > 0 && (
          <div className="flex justify-center">
            <button
              onClick={() => setShowAllShelves((v) => !v)}
              aria-expanded={showAllShelves}
              className="btn btn-ghost btn-sm cursor-pointer rounded-full"
            >
              {showAllShelves
                ? t("hideCollections")
                : t("allCollections", { count: restShelves.length })}
            </button>
          </div>
        )}
        {showAllShelves &&
          restShelves.map(({ persona, rank }) => (
            <PersonaShelf
              key={persona.id}
              persona={persona}
              reason={reasonText(rank)}
              onOpen={openFromShelf(persona.slug)}
            />
          ))}

        {/* ---------- The grid ---------- */}
        <IdeasGrid
          title={visitor.state === "1" ? t("firstView.moreIdeas") : t("firstView.moreIdeasForYou")}
          audience={lens.audience}
          productType={lens.gridType}
          onOpen={(p) => openProduct(p, { surface: "grid" })}
        />
      </div>

      {visitor.state === "3" && profileText && (
        <p className="mt-8 text-center text-[13px] opacity-60">
          {t("firstView.shownFor", { profile: profileText })}{" "}
          <Link href="/dashboard" className="font-semibold underline">
            {t("firstView.change")}
          </Link>
        </p>
      )}

      <div className="mt-10 flex flex-col items-center gap-2">
        <Link href="/discover/browse" className="btn btn-neutral btn-wide cursor-pointer rounded-full">
          {t("browseAll")}
        </Link>
        <p className="text-xs opacity-50">{t("browseAllHint")}</p>
      </div>

      <p className="mt-14 text-center text-xs opacity-50">{t("affiliateDisclosure")}</p>

      <ProductModal product={selected} userId={accountId} onClose={() => setSelected(null)} />
    </div>
  );
}
