import { PageLoadingShell } from "@/components/loaders/PageLoadingShell";

/**
 * Events was the one section left without a loading state when the rest of the
 * app got one — so the list arrived as a blank page under a real navbar.
 * Mirrors the shape SsHomeScreen settles into: a title, then event rows.
 */
export default function Loading() {
  return (
    <PageLoadingShell>
      <div className="mx-auto w-full max-w-[720px]">
        <div className="nr-skeleton mb-2 h-8 w-48" />
        <div className="nr-skeleton mb-7 h-4 w-72" />
        <div className="grid gap-3">
          <div className="nr-skeleton h-[92px] w-full rounded-[24px]" />
          <div className="nr-skeleton h-[92px] w-full rounded-[24px]" />
          <div className="nr-skeleton h-[92px] w-full rounded-[24px]" />
        </div>
      </div>
    </PageLoadingShell>
  );
}
