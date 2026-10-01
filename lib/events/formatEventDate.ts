/**
 * Event dates are calendar days, not instants.
 *
 * `ss_events.event_date` is a Postgres `date` and arrives as "YYYY-MM-DD".
 * `new Date("2026-12-24")` reads that as midnight UTC, so anywhere west of UTC
 * it rendered as the 23rd, and even here the weekday could slip. Everything
 * below parses the three numbers and formats them pinned to UTC, so the day
 * shown is the day stored, in every time zone.
 *
 * "Today" for the past-date rule is Lithuanian today, matching the
 * ss_events_date_not_past trigger (migration 20261001130000).
 */

const VILNIUS = "Europe/Vilnius";

type CalendarDate = { year: number; month: number; day: number };

/** "YYYY-MM-DD" (anything after the date is ignored) -> parts, or null. */
export function parseCalendarDate(value: string | null | undefined): CalendarDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** Today in Vilnius as "YYYY-MM-DD", for `<input type="date" min>` and comparisons. */
export function todayInVilnius(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: VILNIUS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** True when a "YYYY-MM-DD" date is before today in Vilnius. */
export function isPastEventDate(value: string | null | undefined, now: Date = new Date()): boolean {
  const d = parseCalendarDate(value);
  if (!d) return false;
  const iso = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
  return iso < todayInVilnius(now);
}

/**
 * Weekday, day and month, plus the year only when it isn't this year, in the
 * locale's own order: "gruodžio 24 d., ketvirtadienis" / "Thursday, December
 * 24", and "2027 m. sausio 2 d., šeštadienis" for next year. Null for no or
 * unparseable dates.
 */
export function formatEventDate(
  value: string | null | undefined,
  locale: string,
  now: Date = new Date()
): string | null {
  const d = parseCalendarDate(value);
  if (!d) return null;
  // Noon UTC, formatted in UTC: no time zone can move it to another day.
  const instant = new Date(Date.UTC(d.year, d.month - 1, d.day, 12));
  const thisYear = Number(todayInVilnius(now).slice(0, 4));
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.year !== thisYear ? { year: "numeric" as const } : {}),
  }).format(instant);
}
