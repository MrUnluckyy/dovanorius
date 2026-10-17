"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { IconType } from "react-icons";
import {
  LuBaby,
  LuBlocks,
  LuChevronRight,
  LuFlower2,
  LuGamepad2,
  LuHeart,
  LuHouse,
  LuUsers,
  LuWatch,
} from "react-icons/lu";
import {
  CHIP_RECIPIENTS,
  EXTRA_RECIPIENTS,
  TILE_RECIPIENTS,
  type PartnerGender,
  type RecipientKey,
} from "@/lib/discover/recipients";

/**
 * Tile art. Icons stand in until real photos exist: a product shot from the
 * feed reads as an ad ("a bra for Moteriai"), and eight image requests above
 * the fold would cost the LCP target. Drop a path in here per key when the
 * photos are ready; the tile switches to it.
 */
const TILE_ART: Record<RecipientKey, { Icon: IconType; image?: string }> = {
  woman: { Icon: LuFlower2 },
  man: { Icon: LuWatch },
  self: { Icon: LuHeart },
  couple: { Icon: LuUsers },
  home: { Icon: LuHouse },
  kid: { Icon: LuBlocks },
  teen: { Icon: LuGamepad2 },
  baby: { Icon: LuBaby },
  partner: { Icon: LuHeart },
  mom: { Icon: LuFlower2 },
  friend: { Icon: LuFlower2 },
};

/** State 1: "Kam ieškai dovanos?" — eight tiles, 2 columns on phones. */
export function RecipientTiles({
  selected,
  onSelect,
}: {
  selected: RecipientKey | null;
  onSelect: (key: RecipientKey | null) => void;
}) {
  const t = useTranslations("Discover.recipient");

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {TILE_RECIPIENTS.map((key) => {
        const { Icon, image } = TILE_ART[key];
        const on = selected === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(on ? null : key)}
            aria-pressed={on}
            className={`flex cursor-pointer flex-col overflow-hidden rounded-2xl border text-left transition ${
              on
                ? "border-neutral ring-2 ring-neutral"
                : "border-base-300 bg-base-100 hover:border-base-content/30"
            }`}
          >
            <span className="flex h-20 items-center justify-center bg-primary/25">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="h-full w-full object-cover" />
              ) : (
                <Icon className="h-8 w-8 opacity-70" aria-hidden />
              )}
            </span>
            <span className="flex items-center justify-between px-3 py-2.5">
              <span className="text-[15px] font-bold">{t(key)}</span>
              <LuChevronRight className="w-4 opacity-50" aria-hidden />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * States 2-3: one chip row, "Sau" first. "Kitam…" opens the rest of the
 * recipients in place; "Partneriui" asks Jai / Jam, because guessing a
 * partner's gender from the visitor's would be wrong for plenty of people.
 */
export function RecipientChips({
  selected,
  partner,
  onSelect,
  onPartner,
}: {
  selected: RecipientKey | null;
  partner: PartnerGender;
  onSelect: (key: RecipientKey) => void;
  onPartner: (g: PartnerGender) => void;
}) {
  const t = useTranslations("Discover");
  const [showExtra, setShowExtra] = useState(
    selected != null && EXTRA_RECIPIENTS.includes(selected)
  );

  const chip = (on: boolean) =>
    `inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold transition ${
      on
        ? "border-neutral bg-neutral text-neutral-content"
        : "border-base-300 bg-base-100 hover:border-base-content/30"
    }`;

  return (
    <div className="space-y-2">
      <nav
        aria-label={t("firstView.recipientsLabel")}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {CHIP_RECIPIENTS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            aria-pressed={selected === key}
            className={chip(selected === key)}
          >
            {t(`recipient.${key}`)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowExtra((v) => !v)}
          aria-expanded={showExtra}
          className={chip(false)}
        >
          {t("firstView.other")}
        </button>
      </nav>

      {showExtra && (
        <div className="flex flex-wrap gap-2">
          {EXTRA_RECIPIENTS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-pressed={selected === key}
              className={chip(selected === key)}
            >
              {t(`recipient.${key}`)}
            </button>
          ))}
        </div>
      )}

      {selected === "partner" && (
        <div className="flex gap-2">
          {(["female", "male"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onPartner(partner === g ? null : g)}
              aria-pressed={partner === g}
              className={chip(partner === g)}
            >
              {t(g === "female" ? "firstView.partnerHer" : "firstView.partnerHim")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
