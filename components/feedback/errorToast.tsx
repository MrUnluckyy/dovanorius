"use client";

import toast from "react-hot-toast";
import { LuCircleAlert } from "react-icons/lu";
import { openReportDialog, type ReportContext } from "@/lib/report";

/**
 * An error the person can do something about.
 *
 * The old one was `toast.error("😵 Upsss!")` — a dead end that said nothing
 * happened, offered no next step, and left the only trace of a real outage in
 * someone else's browser console. This keeps the apology short and adds the
 * one thing that was missing: a way to tell us.
 */
export function errorToast({
  title,
  body,
  reportLabel,
  context,
}: {
  title: string;
  body?: string;
  reportLabel: string;
  /** Carried into the report so nobody has to describe what they were doing. */
  context: ReportContext;
}) {
  toast.custom(
    (tst) => (
      <div
        className={`flex max-w-sm items-start gap-3 rounded-xl border border-base-300 bg-base-100 p-4 shadow-lg ${
          tst.visible ? "animate-in" : "opacity-0"
        }`}
        role="alert"
      >
        <LuCircleAlert className="mt-0.5 shrink-0 text-xl text-error" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{title}</p>
          {body && (
            <p className="mt-0.5 text-sm leading-relaxed text-base-content/70">
              {body}
            </p>
          )}
          <button
            type="button"
            className="link link-hover mt-2 text-sm font-medium"
            onClick={() => {
              toast.dismiss(tst.id);
              openReportDialog(context);
            }}
          >
            {reportLabel}
          </button>
        </div>
      </div>
    ),
    { duration: 8000 }
  );
}
