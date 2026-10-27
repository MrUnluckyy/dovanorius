import { PageLoadingShell } from "@/components/loaders/PageLoadingShell";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";

export default function Loading() {
  return (
    <PageLoadingShell>
      <div className="nr-skeleton h-4 w-32 mb-8" />
      <BoardsLoadingSkeleton />
    </PageLoadingShell>
  );
}
