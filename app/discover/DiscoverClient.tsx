"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LuSearch, LuSparkles } from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { useGiftIdeas } from "@/hooks/useGiftIdeas";
import { useDiscoverAudience } from "@/hooks/useDiscoverAudience";

import { type CardProduct } from "./_components/ProductCard";
import { CATEGORIES, AUDIENCES, browseHref } from "./_components/filters";
import Link from "next/link";
import { PersonaShelf } from "./_components/PersonaShelf";
import { usePersonas } from "@/hooks/usePersonas";
import { ProductStrip } from "./_components/ProductStrip";
import { ProductModal } from "./_components/ProductModal";
import { trackInspo } from "@/utils/trackInspo";

export function DiscoverClient() {
  const t = useTranslations("Discover");
  const router = useRouter();
  // Persona labels are DB rows, not i18n keys, so the locale is picked here.
  const locale = useLocale();

  const [userId, setUserId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<CardProduct | null>(null);
  /** Which recipient the shopper is buying for; null = no persona chosen. */
  const [personaId, setPersonaId] = useState<string | null>(null);

  const { data: personas } = usePersonas();
  // Recipients are offered in the picker; themes render inline.
  //
  // Editorial shelves sit in the same inline row: same renderer, same
  // sort_order, only the source of their picks differs (hand-made in /admin
  // rather than LLM-curated). They arrive already filtered by their schedule —
  // the gift_personas SELECT policy drops any shelf outside its window, so an
  // unpublished one is not in `personas` at all.
  const recipients = personas?.filter((p) => p.kind === "recipient") ?? [];
  const themes =
    personas?.filter((p) => p.kind === "theme" || p.kind === "editorial") ?? [];
  const activePersona = recipients.find((p) => p.id === personaId) ?? null;

  // Audience comes from the profile now (self-declared gender, or the last
  // choice made here) instead of resetting to "everyone" on every visit.
  const { audience, setAudience, resolved: audienceResolved } =
    useDiscoverAudience(userId);

  const supabase = createClient();


  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;
      setUserId(user.id);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);




  // AI "we suggest" strip — only fetched (LLM cost) on the inspire page.
  const { data: aiData, isLoading: aiLoading } = useGiftIdeas(
    userId,
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


  const openProduct = (p: CardProduct) => {
    setSelected(p);
    trackInspo("open", p.id);
  };


  // ===== Inspire: the page. Shelves with a reason, not a wall of products. =====
    return (
      <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6">
        <header className="mb-6">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-xl text-sm opacity-60">{t("subtitle")}</p>
        </header>

        {/* Search stays reachable from the inspire page: someone who arrives
            already knowing what they want should not have to find "browse all"
            first. Submitting carries the query straight into browse, which is
            the only mode with a result grid. */}
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

        {/* Audience — the one control worth showing up front, because it
            changes every shelf below it. Seeded from the profile. */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium opacity-70">
            {t("audiencePrompt")}
          </span>
          {AUDIENCES.map((a) => (
            <button
              key={a}
              onClick={() => setAudience(a)}
              aria-pressed={audience === a}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm transition ${
                audience === a
                  ? "bg-neutral text-neutral-content"
                  : "bg-base-200 hover:bg-base-300"
              }`}
            >
              {t(`audience.${a}`)}
            </button>
          ))}
        </div>

        {/* Recipient personas. Distinct from the audience chips above: audience
            is a broad her/him/everyone lens over every shelf, a persona is a
            specific person ("Paaugliui") with a hand-curated shelf behind it.
            Selecting one also sets the audience, so the themed shelves below
            follow along rather than contradicting the choice. */}
        {!!recipients.length && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium opacity-70">
              {t("personaPrompt")}
            </span>
            {recipients.map((p) => {
              const active = personaId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setPersonaId(active ? null : p.id);
                    if (!active && p.gender) {
                      setAudience(p.gender === "female" ? "her" : "him");
                    }
                  }}
                  aria-pressed={active}
                  className={`cursor-pointer rounded-full px-4 py-1.5 text-sm transition ${
                    active
                      ? "bg-primary text-primary-content"
                      : "bg-base-200 hover:bg-base-300"
                  }`}
                >
                  {locale === "en" ? p.label_en : p.label_lt}
                </button>
              );
            })}
          </div>
        )}

        {/* Direct routes into the catalogue. Someone arriving who already knows
            the shape of what they want should not have to read the whole page
            to find the way in. */}
        <div
          className="-mx-1 mb-6 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0, #000 12px, #000 calc(100% - 28px), transparent 100%)",
          }}
        >
          {CATEGORIES.map((c) => (
            <Link
              key={c.type}
              href={browseHref({ type: c.type })}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-base-200 px-3 py-1.5 text-sm transition hover:bg-base-300"
            >
              <c.Icon className="w-4 shrink-0" aria-hidden />
              {t(`category.${c.key}`)}
            </Link>
          ))}
        </div>

        {/* Wait for the profile before rendering shelves, otherwise every shelf
            loads for "everyone" and then visibly swaps. */}
        {!audienceResolved ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="nr-skeleton h-72 w-full rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Leads the page when chosen: the shopper just told us exactly who
                this is for, so it outranks both the generic shelves and the
                personal strip (which models the SHOPPER, not the recipient). */}
            {activePersona && (
              <PersonaShelf persona={activePersona} onOpen={openProduct} />
            )}

            {userId && (aiLoading || aiIdeas.length > 0) && (
              <ProductStrip
                title={t("collections.weSuggest")}
                subtitle={t("collections.weSuggestSubtitle")}
                Icon={LuSparkles}
                items={aiIdeas}
                isLoading={aiLoading}
                onOpen={openProduct}
              />
            )}

            {/* Curated shelves — every themed shelf on the page is now a
                gift_personas row, LLM-curated or hand-picked. The keyword-query
                shelves they replaced are gone. */}
            {themes.map((theme) => (
              <PersonaShelf key={theme.id} persona={theme} onOpen={openProduct} />
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-col items-center gap-2">
          <Link
            href="/discover/browse"
            className="btn btn-neutral btn-wide cursor-pointer rounded-full"
          >
            {t("browseAll")}
          </Link>
          <p className="text-xs opacity-50">{t("browseAllHint")}</p>
        </div>

        <p className="mt-14 text-center text-xs opacity-50">
          {t("affiliateDisclosure")}
        </p>

        <ProductModal
          product={selected}
          userId={userId}
          onClose={() => setSelected(null)}
        />
      </div>
  );
}
