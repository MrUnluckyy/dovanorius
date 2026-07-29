// Gift engine tuning + cost table.
//
// Model is Opus 4.8 — the ranker has to judge gender-appropriateness from
// Lithuanian product names and enforce category variety, which the strongest
// model does noticeably better. Calls are cached per user for a week, so the
// higher per-call cost is amortized to near-zero. Drop to "claude-sonnet-5"
// (one line) for ~⅓ the cost if the quality gap isn't worth it.
export const GIFT_MODEL = "claude-opus-4-8";

export const RECENT_ITEMS = 40; // how many of a user's wishes feed the taste model
export const CANDIDATE_LIMIT = 25; // products handed to the ranker (fewer = cheaper input; 5/category still gives the ranker variety)
export const MAX_PICKS = 8; // gifts returned per request
export const REC_TTL_HOURS = 24 * 30; // recommendation cache lifetime — 30d keeps LLM calls infrequent (cost control)

// USD per 1M tokens, for the cost readout on each response.
export const MODEL_PRICES: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-opus-4-8": { in: 5, out: 25 },
};
