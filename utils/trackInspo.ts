/** Events about one product. The server looks the product up by id. */
export const PRODUCT_EVENT_TYPES = ["open", "save", "click_out"] as const;

/** Events about the page or the visitor's choices; no product attached. */
export const PAGE_EVENT_TYPES = [
  "discover_view",
  "recipient_selected",
  "nudge_shown",
  "nudge_answered",
  "nudge_dismissed",
] as const;

/**
 * The only context keys the server keeps (values: short strings). Mirrors the
 * views in 20261017165811_discover_tracking.sql:
 *   page      inspire | browse | shop
 *   state     first-view state, "1".."4" (T2); "legacy" until then
 *   recipient recipient slug or tile key
 *   question  nudge question: gender | age | buys_for
 *   answer    the chosen value
 *   surface   where a product was opened: shelf | grid | ai | search
 *   shelf     persona slug the product was opened from
 */
export const CONTEXT_KEYS = [
  "page",
  "state",
  "recipient",
  "question",
  "answer",
  "surface",
  "shelf",
] as const;

export type InspoEventType = (typeof PRODUCT_EVENT_TYPES)[number];
export type DiscoverEventType = (typeof PAGE_EVENT_TYPES)[number];
export type TrackContext = Partial<Record<(typeof CONTEXT_KEYS)[number], string>>;

/**
 * Uses sendBeacon so it survives navigation (e.g. a "View in store" click
 * opening a new tab), and never throws into the caller. The session id is a
 * cookie the route sets, so nothing is kept in browser storage here.
 */
function send(payload: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/track",
        new Blob([body], { type: "application/json" })
      );
    } else {
      void fetch("/api/track", {
        method: "POST",
        body,
        keepalive: true,
        headers: { "content-type": "application/json" },
      });
    }
  } catch {
    // Analytics must never break the UX.
  }
}

/**
 * Fire-and-forget engagement beacon for one product. The server looks up
 * authoritative merchant/brand/type from the product id — we only send the id,
 * the event type and optional context.
 */
export function trackInspo(
  type: InspoEventType,
  productId: string,
  context?: TrackContext
): void {
  if (!productId) return;
  send({ type, productId, context });
}

/** Page-level discover event: a view, a recipient choice, a nudge step. */
export function trackDiscover(
  type: DiscoverEventType,
  context?: TrackContext
): void {
  send({ type, context });
}
