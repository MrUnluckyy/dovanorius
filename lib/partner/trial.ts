/**
 * Partner trial: every partner gets TRIAL_MONTHS from the day their account
 * was created. Derived, not stored — there is no per-partner override yet, and
 * nothing is switched off when it ends; the panel and /admin only warn.
 */

export const TRIAL_MONTHS = 3;

/** How early the "ending soon" notice appears. */
export const TRIAL_WARN_DAYS = 14;

export const PARTNER_CONTACT_EMAIL = "partneriai@noriuto.lt";

export type TrialState = "active" | "ending" | "ended";

export type TrialStatus = {
  state: TrialState;
  endsAt: Date;
  /** Whole days until endsAt; negative once it has passed. */
  daysLeft: number;
};

const DAY = 86_400_000;

/** created_at + N calendar months, clamped so 30 Nov + 3 lands on 28/29 Feb. */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function trialStatus(createdAt: string | Date, now = new Date()): TrialStatus {
  const endsAt = addMonths(new Date(createdAt), TRIAL_MONTHS);
  const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / DAY);
  const state: TrialState =
    daysLeft <= 0 ? "ended" : daysLeft <= TRIAL_WARN_DAYS ? "ending" : "active";
  return { state, endsAt, daysLeft };
}
