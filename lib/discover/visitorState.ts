import {
  isRecipientKey,
  type RecipientKey,
  type VisitorGender,
} from "./recipients";

/**
 * Which first view a visitor gets (dev-issue-discover-premium 4.1). Resolved
 * on the server from the profile, so the page renders the right state on the
 * first paint instead of flashing skeletons while auth loads.
 *
 * State 4 (from an event) is T4 and not resolved here yet.
 */
export type VisitorState = "1" | "2" | "3";

export type AgeBand = "18-24" | "25-34" | "35-44" | "45-54" | "55+";

export type Visitor = {
  state: VisitorState;
  /** First name, already in the vocative for the greeting; null if unknown. */
  greetingName: string | null;
  gender: VisitorGender;
  ageBand: AgeBand | null;
  /** Preselected recipient: last choice, or "self" once the gender is known. */
  recipient: RecipientKey | null;
  /** Signed in with a real account (can save). Guests and visitors: false. */
  isAccount: boolean;
};

export type ProfileRow = {
  display_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  last_recipient: string | null;
};

export function ageBandFromDob(dob: string | null, now = new Date()): AgeBand | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  if (age < 18) return null;
  if (age < 25) return "18-24";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  if (age < 55) return "45-54";
  return "55+";
}

function normaliseGender(g: string | null): VisitorGender {
  return g === "female" || g === "male" || g === "other" ? g : null;
}

/**
 * Lithuanian vocative of a first name, for "Labas, Ugne". Covers the common
 * endings; anything else (foreign names, initials) is returned unchanged,
 * which reads fine. "-as" takes the everyday "-ai" (Justai, Tomai).
 */
export function vocative(name: string): string {
  const n = name.trim();
  const rules: [RegExp, string][] = [
    [/ius$/, "iau"],
    [/us$/, "au"],
    [/ys$/, "y"],
    [/is$/, "i"],
    [/as$/, "ai"],
    [/ė$/, "e"],
  ];
  for (const [re, rep] of rules) if (re.test(n)) return n.replace(re, rep);
  return n;
}

export function resolveVisitor(profile: ProfileRow | null, isAccount: boolean): Visitor {
  const gender = normaliseGender(profile?.gender ?? null);
  const ageBand = ageBandFromDob(profile?.date_of_birth ?? null);
  const first = profile?.display_name?.trim().split(/\s+/)[0] ?? "";
  const greetingName = isAccount && first.length >= 2 ? vocative(first) : null;

  const state: VisitorState = !gender ? "1" : ageBand ? "3" : "2";
  const last = isRecipientKey(profile?.last_recipient) ? profile!.last_recipient as RecipientKey : null;

  return {
    state,
    greetingName,
    gender,
    ageBand,
    // Signed-in users open on "Sau" (decided 17 Oct) unless they last chose
    // someone else. State 1 opens on the tiles, nothing selected.
    recipient: last ?? (state === "1" ? null : "self"),
    isAccount,
  };
}
