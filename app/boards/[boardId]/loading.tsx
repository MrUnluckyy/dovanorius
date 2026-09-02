import { PageLoadingShell } from "@/components/loaders/PageLoadingShell";
import { BoardDetailSkeleton } from "@/components/loaders/BoardDetailSkeleton";

export default function Loading() {
  return (
    <PageLoadingShell>
      <BoardDetailSkeleton />
    </PageLoadingShell>
  );
}
