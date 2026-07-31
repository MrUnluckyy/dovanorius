// Gift engine tuning + cost table.
//
// Default model is Opus 4.8 — Anthropic's most capable Opus-tier model, for the
// best gift-ranking quality (judging gender-appropriateness from Lithuanian
// product names + category variety). Trade-off: ~3× Sonnet 5's per-token cost
// and higher latency. Override per environment with the GIFT_MODEL env var
// (e.g. GIFT_MODEL=claude-sonnet-5 for cheaper/faster, or claude-haiku-4-5 for
// the cheapest). Any override must be a key in MODEL_PRICES below so the cost
// readout stays accurate.
export const GIFT_MODEL = process.env.GIFT_MODEL ?? "claude-opus-4-8";

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
