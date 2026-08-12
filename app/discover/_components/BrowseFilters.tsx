"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { IconType } from "react-icons";
import { LuSearch, LuSlidersHorizontal, LuArrowUpDown, LuX, LuCheck } from "react-icons/lu";
import type { Audience, InspoSort } from "@/types/inspo";
import { BrandFilter } from "./BrandFilter";

/**
 * Browse filters.
 *
 * The old bar was three stacked rows — eleven wrapping category pills, a mixed
 * set of dropdowns and a toggle, then a chip row repeating state already on
 * screen. Six control shapes competing at the same visual weight, so nothing
 * read as primary.
 *
 * Now: one line of controls, one scrolling rail of categories. Everything
 * secondary (audience, price, brand, sale) collapses into a single Filtrai
 * popover carrying a count, so the bar keeps a fixed height however many filters
 * are on. Chips stay, but only for what the popover hides — no longer echoing
 * controls that are already visible.
 *
 * Styling uses the Noriuto tokens directly rather than DaisyUI defaults: the
 * active state is the brand yellow with its pressed bottom edge, not a slab of
 * neutral. The sale toggle in particular loses its red `btn-error` — the same
 * bargain-bin signal we just took off the product cards.
 */
export type CategoryDef = { key: string; type: string; Icon: IconType };
export type PriceBand = { key: string; min: number | null; max: number | null };

export function BrowseFilters({
  categories, productType, onProductType,
  bands, bandKey, onBandKey,
  brand, onBrand,
  onSaleOnly,
  audiences, audience, onAudience,
  sorts, sort, onSort,
  searchInput, onSearchInput,
}: {
  categories: CategoryDef[];
  productType: string | null;
  onProductType: (t: string | null) => void;
  bands: PriceBand[];
  bandKey: string;
  onBandKey: (k: string) => void;
  brand: string | null;
  onBrand: (b: string | null) => void;
  /**
   * Read-only here: the sale toggle was removed (we are not a shop, so a
   * discount filter pushes the wrong intent — same reason the badge came off the
   * cards). It can still be set by "see all" on the live sale shelf, so it stays
   * in the count and remains clearable via the chip row.
   */
  onSaleOnly: boolean;
  audiences: Audience[];
  audience: Audience;
  onAudience: (a: Audience) => void;
  sorts: InspoSort[];
  sort: InspoSort;
  onSort: (s: InspoSort) => void;
  searchInput: string;
  onSearchInput: (v: string) => void;
}) {
  const t = useTranslations("Discover");
  const [open, setOpen] = useState(false);
  const popover = useRef<HTMLDivElement>(null);

  // Count only what the popover owns — the category rail and search speak for
  // themselves, so including them would inflate the badge misleadingly.
  const activeCount =
    (audience !== "everyone" ? 1 : 0) +
    (bandKey !== "all" ? 1 : 0) +
    (brand ? 1 : 0) +
    (onSaleOnly ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!popover.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      className="sticky top-0 z-30 -mx-4 mb-6 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6"
      style={{
        background: "color-mix(in srgb, var(--nr-cream) 88%, transparent)",
        borderBottom: "1px solid var(--nr-border)",
      }}
    >
      {/* One line: search grows, controls sit right. Fixed height regardless of
          how many filters are active. */}
      <div className="flex items-center gap-2">
        <label
          className="flex min-w-0 grow items-center gap-2 px-3.5 py-2 transition sm:max-w-lg"
          style={{
            background: "var(--nr-surface)",
            border: "1px solid var(--nr-border)",
            borderRadius: "var(--nr-radius-pill)",
          }}
        >
          <LuSearch className="w-4 shrink-0" style={{ color: "var(--nr-faint)" }} />
          <input
            type="search"
            className="min-w-0 grow bg-transparent text-sm outline-none"
            placeholder={t("searchPlaceholder")}
            value={searchInput}
            onChange={(e) => onSearchInput(e.target.value)}
          />
        </label>

        <div className="relative shrink-0" ref={popover}>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex cursor-pointer items-center gap-2 px-3.5 py-2 text-sm font-medium transition"
            style={{
              background: activeCount ? "var(--nr-tile)" : "var(--nr-surface)",
              border: `1px solid ${activeCount ? "var(--nr-yellow-deep)" : "var(--nr-border)"}`,
              borderRadius: "var(--nr-radius-pill)",
              color: "var(--nr-ink)",
            }}
          >
            <LuSlidersHorizontal className="w-4" />
            <span className="hidden sm:inline">{t("filters")}</span>
            {activeCount > 0 && (
              <span
                className="grid h-5 min-w-5 place-items-center px-1 text-xs font-bold"
                style={{
                  background: "var(--nr-ink)",
                  color: "var(--nr-yellow)",
                  borderRadius: "var(--nr-radius-pill)",
                }}
              >
                {activeCount}
              </span>
            )}
          </button>

          {open && (
            <div
              className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] p-4"
              style={{
                background: "var(--nr-surface)",
                border: "1px solid var(--nr-border)",
                borderRadius: "var(--nr-radius-card)",
                boxShadow: "var(--nr-shadow-float)",
              }}
            >
              <Group label={t("audiencePrompt")}>
                <Segmented
                  options={audiences.map((a) => ({ key: a, label: t(`audience.${a}`) }))}
                  value={audience}
                  onChange={(v) => onAudience(v as Audience)}
                />
              </Group>

              <Group label={t("price.label")}>
                <Segmented
                  options={bands.map((b) => ({ key: b.key, label: t(`price.${b.key}`) }))}
                  value={bandKey}
                  onChange={onBandKey}
                  wrap
                />
              </Group>

              <Group label={t("brand.label")}>
                <BrandFilter value={brand} onSelect={onBrand} productType={productType} />
              </Group>

            </div>
          )}
        </div>

        <SortMenu sorts={sorts} sort={sort} onSort={onSort} />
      </div>

      {/* Category rail. Scrolls rather than wraps, so the bar never changes
          height; the mask fade is what tells you there is more to the right. */}
      <div
        className="-mx-1 mt-2.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0, #000 12px, #000 calc(100% - 28px), transparent 100%)",
        }}
      >
        {categories.map((c) => {
          const active = productType === c.type;
          return (
            <button
              key={c.type}
              onClick={() => onProductType(active ? null : c.type)}
              aria-pressed={active}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-sm transition-transform active:scale-[0.97]"
              style={{
                background: active ? "var(--nr-yellow)" : "var(--nr-surface)",
                border: `1px solid ${active ? "var(--nr-yellow-deep)" : "var(--nr-border)"}`,
                boxShadow: active ? "var(--nr-shadow-btn)" : "none",
                borderRadius: "var(--nr-radius-pill)",
                color: "var(--nr-ink)",
                transitionTimingFunction: "var(--nr-ease-spring)",
              }}
            >
              <c.Icon className="w-4 shrink-0" aria-hidden />
              {t(`category.${c.key}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p
        className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--nr-gold-text)" }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

/** Compact segmented control — one tap, no dropdown, state visible at a glance. */
function Segmented({
  options, value, onChange, wrap,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  wrap?: boolean;
}) {
  return (
    <div className={`flex gap-1 ${wrap ? "flex-wrap" : ""}`}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className="cursor-pointer px-2.5 py-1.5 text-sm transition"
            style={{
              background: active ? "var(--nr-ink)" : "var(--nr-tile)",
              color: active ? "var(--nr-yellow)" : "var(--nr-ink-2)",
              borderRadius: "var(--nr-radius-chip)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SortMenu({
  sorts, sort, onSort,
}: {
  sorts: InspoSort[];
  sort: InspoSort;
  onSort: (s: InspoSort) => void;
}) {
  const t = useTranslations("Discover");
  return (
    <div className="dropdown dropdown-end shrink-0">
      <div
        tabIndex={0}
        role="button"
        className="flex cursor-pointer items-center gap-1.5 px-3.5 py-2 text-sm font-medium"
        style={{
          background: "var(--nr-surface)",
          border: "1px solid var(--nr-border)",
          borderRadius: "var(--nr-radius-pill)",
          color: "var(--nr-ink)",
        }}
      >
        <LuArrowUpDown className="w-4" />
        <span className="hidden sm:inline">{t(`sort.${sort}`)}</span>
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content z-40 mt-2 w-52 p-2"
        style={{
          background: "var(--nr-surface)",
          border: "1px solid var(--nr-border)",
          borderRadius: "var(--nr-radius-card)",
          boxShadow: "var(--nr-shadow-float)",
        }}
      >
        {sorts.map((s) => (
          <li key={s}>
            <button
              onClick={() => {
                onSort(s);
                (document.activeElement as HTMLElement)?.blur();
              }}
              className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm transition"
              style={{
                borderRadius: "var(--nr-radius-input)",
                color: "var(--nr-ink)",
                background: sort === s ? "var(--nr-tile)" : "transparent",
              }}
            >
              {t(`sort.${s}`)}
              {sort === s && <LuX className="hidden" />}
              {sort === s && <LuCheck className="w-4" style={{ color: "var(--nr-gold-strong)" }} />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
