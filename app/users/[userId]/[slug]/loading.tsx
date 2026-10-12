import { PageLoadingShell } from "@/components/loaders/PageLoadingShell";
import { BoardDetailSkeleton } from "@/components/loaders/BoardDetailSkeleton";

/**
 * Someone's public board, opened from their profile.
 *
 * app/loading.tsx does NOT cover this hop. A loading boundary only shows its
 * fallback when the segment it wraps is newly mounted; going from
 * /users/<id> to /users/<id>/<slug> changes nothing above [userId], so the
 * root boundary stays revealed and the profile froze on screen until the
 * server finished. A boundary at this level is mounted fresh by the
 * navigation, and also lets the Link prefetch it, so it shows on click.
 */
export default function Loading() {
  return (
    <PageLoadingShell>
      <BoardDetailSkeleton />
    </PageLoadingShell>
  );
}
