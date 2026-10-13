import { ContentSkeleton } from "@/components/loaders/ContentSkeleton";

/**
 * Its own boundary, not just discover/loading.tsx: going from one shop to
 * another only changes the [slug] segment, which the parent boundary does not
 * re-show for. The discover layout renders the navbar, so this fills only main.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-8">
      <ContentSkeleton cards={9} />
    </div>
  );
}
