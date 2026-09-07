import { PageLoadingShell } from "@/components/loaders/PageLoadingShell";
import { EventsListSkeleton } from "@/components/loaders/EventsListSkeleton";

export default function Loading() {
  return (
    <PageLoadingShell>
      <div className="mx-auto w-full max-w-[720px]">
        <div className="nr-skeleton mb-2 h-8 w-48" />
        <div className="nr-skeleton mb-7 h-4 w-72" />
        <EventsListSkeleton />
      </div>
    </PageLoadingShell>
  );
}
