import { ReactNode } from "react";

/**
 * The frame every route-level loading state shares.
 *
 * The bar at the top stands in for the navbar. Each page renders its own
 * `<NavigationV2>` rather than inheriting one from a layout, so a `loading.tsx`
 * that omitted it would make the whole header vanish and snap back the moment
 * the page resolved — worse than the stall it replaces. It cannot render the
 * real navbar either: that needs the session, which is exactly what we are
 * still waiting for, and a signed-in user would see "Log in" flash by.
 */
export function PageLoadingShell({ children }: { children: ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Kraunama…</span>
      <div className="navbar bg-base-100 w-full shadow-sm">
        <div className="flex w-full max-w-[1440px] px-4 mx-auto items-center gap-3">
          <div className="nr-skeleton h-10 w-10 shrink-0 rounded-full" />
          <div className="nr-skeleton hidden h-6 w-24 md:block" />
          <div className="nr-skeleton h-9 w-full max-w-56 rounded-full" />
          <div className="ml-auto hidden gap-2 lg:flex">
            <div className="nr-skeleton h-9 w-28" />
            <div className="nr-skeleton h-9 w-24" />
          </div>
        </div>
      </div>
      <main className="pb-20">
        <div className="max-w-[1440px] mx-auto min-h-screen px-4 pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
