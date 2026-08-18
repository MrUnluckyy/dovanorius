/**
 * How long a reservation holds a gift.
 *
 * Kept in one place because the number is promised in four different voices —
 * the reserve dialog, the confirmation email, the reminder email and the
 * signed keep/release link — and users notice when those disagree.
 *
 * The database is the authority (`set_reservation_ttl` stamps
 * `items.reserve_expires_at`); these are for showing the promise up front and
 * for sizing the link tokens. Change both sides together.
 */
export const HOLD_MONTHS = 6;

/** Generous day-count for token lifetimes: 6 months + slack, never shorter. */
export const HOLD_DAYS_MAX = 200;

/** How long before expiry we send the "still planning to give this?" nudge. */
export const REMIND_WITHIN_DAYS = 14;

/** Adds the hold window to a date, for previewing the expiry before reserving. */
export function holdExpiryFrom(start: Date = new Date()): Date {
  const end = new Date(start);
  end.setMonth(end.getMonth() + HOLD_MONTHS);
  return end;
}
