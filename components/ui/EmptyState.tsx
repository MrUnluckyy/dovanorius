import type { ReactNode } from "react";
import { Hero3D, type Hero3DName } from "./Hero3D";

/**
 * An empty list that says what goes here and how to get it there — the
 * mobile app's pattern (3D object, title, one line, one action).
 * `compact` is for a section inside a page rather than a whole tab.
 */
export function EmptyState({
  hero,
  title,
  hint,
  action,
  compact = false,
  className = "",
}: {
  hero: Hero3DName;
  title: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <div
        className={`flex items-center gap-4 rounded-3xl border border-(--nr-border) bg-(--nr-surface) p-4 ${className}`}
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-(--nr-tile)">
          <Hero3D name={hero} size={40} still />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          {hint && <p className="text-sm text-(--nr-muted)">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  }

  return (
    <div
      className={`mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center ${className}`}
    >
      <Hero3D name={hero} size={88} />
      <h2 className="font-heading text-2xl font-bold">{title}</h2>
      {hint && <p className="text-(--nr-muted)">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
