"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LuCalendar, LuChevronLeft, LuChevronRight, LuX } from "react-icons/lu";
import { formatEventDate, parseCalendarDate, todayInVilnius } from "@/lib/events/formatEventDate";

/**
 * A calendar-day picker in the Noriuto look, replacing <input type="date">.
 *
 * The native picker rendered the browser's own popup: English month names on
 * a Lithuanian page, US-style blue, and a field showing "01/10/2026". This one
 * speaks the page's locale, starts weeks on Monday, greys out days before
 * `min`, marks today, and shows the chosen day the way the rest of the app
 * writes dates ("spalio 24 d., šeštadienis").
 *
 * Values are "YYYY-MM-DD" strings, as before, so forms and the database don't
 * change. All date math is on calendar days in UTC; nothing here goes through
 * the browser's time zone.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Monday = 0 … Sunday = 6. */
const weekday = (y: number, m: number, d: number) => (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
const addDays = (value: string, n: number) => {
  const p = parseCalendarDate(value)!;
  const dt = new Date(Date.UTC(p.year, p.month - 1, p.day + n));
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
};
const addMonths = (value: string, n: number) => {
  const p = parseCalendarDate(value)!;
  const first = new Date(Date.UTC(p.year, p.month - 1 + n, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth() + 1;
  return iso(y, m, Math.min(p.day, daysIn(y, m)));
};
const capitalise = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

export default function DatePicker({
  value,
  onChange,
  min,
  max,
  id,
  labelledBy,
  placeholder,
  clearable = true,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  /** Earliest pickable day, "YYYY-MM-DD". */
  min?: string;
  /** Latest pickable day, "YYYY-MM-DD". */
  max?: string;
  id?: string;
  /** Id of the visible label. Don't wrap the picker in <label>: a click on
   *  the open calendar would "activate" the label and close it. */
  labelledBy?: string;
  placeholder?: string;
  /** False for a required date: no ✕ and no "Clear". */
  clearable?: boolean;
  /** Classes for the field, so it matches the form's other inputs. */
  className?: string;
}) {
  const t = useTranslations("DatePicker");
  const locale = useLocale();
  const today = todayInVilnius();

  const [open, setOpen] = useState(false);
  // The keyboard-focused day; also decides which month is on screen.
  const [cursor, setCursor] = useState(value || (min && min > today ? min : today));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const view = parseCalendarDate(cursor)!;

  // Opening lands on the chosen day (or today), with focus inside the grid.
  useEffect(() => {
    if (!open) return;
    setCursor(value || (min && min > today ? min : today));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${cursor}"]`)?.focus();
  }, [open, cursor]);

  // Click outside closes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const monthLabel = useMemo(
    () =>
      capitalise(
        new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
          new Date(Date.UTC(view.year, view.month - 1, 1))
        )
      ),
    [locale, view.year, view.month]
  );
  const weekdayLabels = useMemo(
    () =>
      // 2024-01-01 was a Monday.
      Array.from({ length: 7 }, (_, i) =>
        capitalise(
          new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
            new Date(Date.UTC(2024, 0, 1 + i))
          )
        ).replace(/\.$/, "")
      ),
    [locale]
  );

  const isDisabled = (day: string) => (!!min && day < min) || (!!max && day > max);
  /** Keep the cursor between min and max. */
  const clamp = (day: string) => (min && day < min ? min : max && day > max ? max : day);
  const goMonth = (n: number) => setCursor(clamp(addMonths(cursor, n)));
  const pick = (day: string) => {
    if (isDisabled(day)) return;
    onChange(day);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const firstOfView = iso(view.year, view.month, 1);
  // Every day of the previous month is before min once this month starts at
  // or before it; likewise the next month once this one ends at or after max.
  const prevDisabled = !!min && firstOfView <= min;
  const lastOfView = iso(view.year, view.month, daysIn(view.year, view.month));
  const nextDisabled = !!max && lastOfView >= max;
  const lead = weekday(view.year, view.month, 1);
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysIn(view.year, view.month) }, (_, i) => iso(view.year, view.month, i + 1)),
  ];

  const onGridKey = (e: React.KeyboardEvent) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      PageUp: () => addMonths(cursor, -1),
      PageDown: () => addMonths(cursor, 1),
    };
    if (moves[e.key]) {
      e.preventDefault();
      setCursor(clamp(moves[e.key]()));
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  const shown = formatEventDate(value, locale);

  return (
    <div ref={rootRef} className="relative">
      <div className={`flex w-full items-center gap-2 ${className}`}>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby={labelledBy ? `${labelledBy} ${id ?? ""}`.trim() : undefined}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left outline-none"
        >
          <LuCalendar className="shrink-0 text-(--nr-faint)" aria-hidden />
          <span className={`min-w-0 flex-1 truncate ${shown ? "text-(--nr-ink)" : "text-(--nr-faint)"}`}>
            {shown ? capitalise(shown) : placeholder ?? t("placeholder")}
          </span>
        </button>
        {value && clearable && (
          <button
            type="button"
            aria-label={t("clear")}
            onClick={() => onChange("")}
            className="-my-1 grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full text-(--nr-faint) transition hover:bg-(--nr-tile) hover:text-(--nr-ink)"
          >
            <LuX size={14} />
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-label={t("dialogLabel")}
          data-testid="date-picker"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 rounded-[22px] border border-(--nr-border) bg-(--nr-surface) p-4 shadow-[0_18px_40px_rgba(35,31,24,0.14)] sm:right-auto sm:w-[340px]"
        >
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              disabled={prevDisabled}
              aria-label={t("prevMonth")}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-(--nr-ink) transition hover:bg-(--nr-tile) disabled:cursor-default disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <LuChevronLeft />
            </button>
            <p className="flex-1 text-center text-[15px] font-semibold text-(--nr-ink)" aria-live="polite">
              {monthLabel}
            </p>
            <button
              type="button"
              onClick={() => goMonth(1)}
              disabled={nextDisabled}
              aria-label={t("nextMonth")}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-(--nr-ink) transition hover:bg-(--nr-tile) disabled:cursor-default disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <LuChevronRight />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center" aria-hidden>
            {weekdayLabels.map((w, i) => (
              <span key={i} className="pb-1 text-[12px] font-semibold uppercase tracking-wide text-(--nr-faint)">
                {w}
              </span>
            ))}
          </div>

          <div ref={gridRef} role="grid" className="grid grid-cols-7 gap-1" onKeyDown={onGridKey}>
            {cells.map((day, i) => {
              if (!day) return <span key={`blank-${i}`} />;
              const disabled = isDisabled(day);
              const selected = day === value;
              const isToday = day === today;
              return (
                <button
                  key={day}
                  type="button"
                  data-day={day}
                  tabIndex={day === cursor ? 0 : -1}
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={capitalise(formatEventDate(day, locale) ?? day)}
                  onClick={() => pick(day)}
                  onFocus={() => setCursor(day)}
                  className={`relative grid aspect-square cursor-pointer place-items-center rounded-full text-[15px] tabular-nums outline-none transition focus-visible:ring-2 focus-visible:ring-(--nr-ink) ${
                    selected
                      ? "bg-(--nr-yellow) font-bold text-(--nr-ink) shadow-[0_2px_0_var(--nr-yellow-deep)]"
                      : disabled
                      ? "cursor-default text-(--nr-faint) opacity-45 line-through decoration-1"
                      : "text-(--nr-ink) hover:bg-(--nr-tile)"
                  }`}
                >
                  {Number(day.slice(8))}
                  {isToday && !selected && (
                    <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-(--nr-yellow-deep)" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-(--nr-border) pt-3">
            {clearable ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="cursor-pointer rounded-full px-3 py-1.5 text-[14px] font-semibold text-(--nr-muted) transition hover:bg-(--nr-tile) hover:text-(--nr-ink)"
            >
              {t("clear")}
            </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => pick(today)}
              disabled={isDisabled(today)}
              className="cursor-pointer rounded-full bg-(--nr-tile) px-3.5 py-1.5 text-[14px] font-semibold text-(--nr-ink) transition hover:bg-(--nr-yellow-soft) disabled:opacity-40"
            >
              {t("today")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
