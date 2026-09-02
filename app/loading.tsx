import { PageLoadingShell } from "@/components/loaders/PageLoadingShell";
import { ContentSkeleton } from "@/components/loaders/ContentSkeleton";

/**
 * The catch-all. Next uses the nearest loading.tsx up the tree, so this one
 * covers every route that doesn't define its own — which is most of them.
 * Segments whose layout already renders the navbar override it with a
 * content-only version, since this one draws a stand-in navbar.
 */
export default function Loading() {
  return (
    <PageLoadingShell>
      <ContentSkeleton />
    </PageLoadingShell>
  );
}
