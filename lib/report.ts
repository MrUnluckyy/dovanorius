/** Which flow a failure came from. Coarse on purpose — useful for grouping. */
export type ReportArea = "reserve" | "auth" | "board" | "other";

type ErrorBeacon = {
  area: ReportArea;
  /** Machine reason, e.g. "rpc_failed". Not shown to anyone. */
  reason: string;
  /** Item id, board id, the driver's own message — whatever helps triage. */
  detail?: Record<string, unknown>;
};

/**
 * Tells us something broke, without asking the person anything.
 *
 * A total outage of guest reserving went unnoticed for fifteen hours because
 * the only trace was a console.error on someone else's phone. This is the
 * cheapest possible fix: the failure reaches a table we can query and alert on.
 *
 * sendBeacon so it survives the navigation that often follows an error, and it
 * never throws into the caller — telemetry must not be able to break a flow
 * that is already going badly.
 */
export function reportError({ area, reason, detail }: ErrorBeacon): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      kind: "error",
      area,
      reason,
      detail: detail ?? {},
      path: window.location.pathname,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/report",
        new Blob([body], { type: "application/json" })
      );
    } else {
      void fetch("/api/report", {
        method: "POST",
        body,
        keepalive: true,
        headers: { "content-type": "application/json" },
      });
    }
  } catch {
    // Never break a flow to file a report about the flow breaking.
  }
}

/**
 * The other half: what a person chose to tell us, carrying the context they
 * should not have to describe. Awaited, unlike the beacon, because they are
 * waiting to be told it arrived.
 */
export async function sendReport(input: {
  area: ReportArea;
  reason?: string;
  message: string;
  contactEmail?: string;
  detail?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "report",
        area: input.area,
        reason: input.reason ?? null,
        message: input.message,
        contactEmail: input.contactEmail ?? null,
        detail: input.detail ?? {},
        path: window.location.pathname,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------
 * The human half
 * ------------------------------------------------------------------ */

export type ReportContext = {
  area: ReportArea;
  reason?: string;
  detail?: Record<string, unknown>;
  /** Prefills the reply-to field, e.g. the address just typed to reserve. */
  contactEmail?: string;
};

/** Event the global dialog listens for. */
export const REPORT_EVENT = "noriuto:report";

/**
 * Opens the "tell us what happened" sheet from anywhere — including hooks and
 * toasts, which have nowhere to render a dialog of their own. A custom event
 * rather than a provider: this needs one listener for the whole app, not a
 * context every consumer has to be wrapped in.
 */
export function openReportDialog(ctx: ReportContext): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ReportContext>(REPORT_EVENT, { detail: ctx }));
}
