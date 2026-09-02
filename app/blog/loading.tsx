import { ProseSkeleton } from "@/components/loaders/ContentSkeleton";

/** The blog layout already renders the navbar, so this fills only its main. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10">
      <ProseSkeleton />
    </div>
  );
}
