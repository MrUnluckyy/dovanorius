import { PageLoadingShell } from "@/components/loaders/PageLoadingShell";
import { UserLoadingSkeleton } from "@/components/loaders/UserLoadingSkeleton";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";

/**
 * A profile, opened from people search (/users → /users/<id>). Same gap as
 * [slug]/loading.tsx: the hop stays inside /users, so the root boundary never
 * shows.
 */
export default function Loading() {
  return (
    <PageLoadingShell>
      <div className="py-8 mb-4 md:mb-10">
        <UserLoadingSkeleton />
      </div>
      <BoardsLoadingSkeleton />
    </PageLoadingShell>
  );
}
