import { MODEL_PRICES } from "./config";

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

/** USD for one call: cache reads bill at 0.1x input, writes at 1.25x. */
export function usdCost(model: string, u: Usage): number {
  const p = MODEL_PRICES[model] ?? MODEL_PRICES["claude-haiku-4-5"];
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  return (
    (u.input_tokens * p.in +
      cacheRead * p.in * 0.1 +
      cacheWrite * p.in * 1.25 +
      u.output_tokens * p.out) /
    1e6
  );
}
