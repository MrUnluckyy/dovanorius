// Single source of truth for per-event-type behaviour, reused by the create
// wizard, event cards, and the lobby. Keeps type-specific rules (theme, min
// members, budget, draw-vs-list) in one place instead of scattered conditionals.
import type { SsEventType } from "@/types/secret-santa";

export type EventTypeMeta = {
  type: SsEventType;
  emoji: string;
  /** i18n key under the `Events` namespace for the human label. */
  labelKey: string;
  /** Draw-based types assign each participant a recipient (santa, name draw). */
  isDrawType: boolean;
  /** DaisyUI theme to apply in the lobby; null = inherit the app theme. */
  theme: "christmas" | null;
  /** Minimum confirmed members required before a draw can happen. */
  minMembers: number;
  /** Whether a per-person budget is meaningful for this type. */
  showBudget: boolean;
};

export const EVENT_TYPE_META: Record<SsEventType, EventTypeMeta> = {
  secret_santa: {
    type: "secret_santa",
    emoji: "🎅",
    labelKey: "ssLabel",
    isDrawType: true,
    theme: "christmas",
    minMembers: 3,
    showBudget: true,
  },
  name_draw: {
    type: "name_draw",
    emoji: "🎲",
    labelKey: "nameDrawLabel",
    isDrawType: true,
    theme: null,
    minMembers: 2,
    showBudget: false,
  },
  group: {
    type: "group",
    emoji: "🎁",
    labelKey: "groupLabel",
    isDrawType: false,
    theme: null,
    minMembers: 2,
    showBudget: false,
  },
};

/** Safe lookup that tolerates unknown/legacy type strings from the DB. */
export function getEventTypeMeta(type: string | null | undefined): EventTypeMeta {
  return EVENT_TYPE_META[(type ?? "secret_santa") as SsEventType] ?? EVENT_TYPE_META.secret_santa;
}

/** Types offered in the create wizard (Group Gift UI is deferred). */
export const CREATABLE_EVENT_TYPES: SsEventType[] = ["secret_santa", "name_draw"];
