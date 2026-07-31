export type InspoEventType = "open" | "save" | "click_out";

/**
 * Fire-and-forget engagement beacon for the discover feed. Uses sendBeacon so
 * it survives navigation (e.g. a "View in store" click opening a new tab), and
 * never throws into the caller. The server looks up authoritative merchant/
 * brand/type from the product id — we only send the id + event type.
 */
export function trackInspo(type: InspoEventType, productId: string): void {
  if (typeof window === "undefined" || !productId) return;
  try {
    const body = JSON.stringify({ type, productId });
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
