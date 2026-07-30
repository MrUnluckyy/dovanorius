// Gift engine tuning + cost table.
//
// Default model is Sonnet 5 — near-Opus quality on this ranking task (judging
// gender-appropriateness from Lithuanian product names + category variety) at
// roughly a third of Opus 4.8's per-token cost. Override per environment with
// the GIFT_MODEL env var (e.g. GIFT_MODEL=claude-opus-4-8 for the highest
// quality, or claude-haiku-4-5 for the cheapest). Any override must be a key in
// MODEL_PRICES below so the cost readout stays accurate.
export const GIFT_MODEL = process.env.GIFT_MODEL ?? "claude-sonnet-5";

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
