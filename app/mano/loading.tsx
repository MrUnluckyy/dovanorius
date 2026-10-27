import { PageLoadingShell } from "@/components/loaders/PageLoadingShell";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";

export default function Loading() {
  return (
    <PageLoadingShell>
      <div className="flex items-center gap-4 mb-8">
        <div className="nr-skeleton h-20 w-20 rounded-full" />
        <div className="flex flex-col gap-2">
          <div className="nr-skeleton h-7 w-40" />
          <div className="nr-skeleton h-4 w-24" />
        </div>
      </div>
      <div className="flex gap-2 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="nr-skeleton h-9 w-24" />
        ))}
      </div>
      <BoardsLoadingSkeleton />
    </PageLoadingShell>
  );
}
