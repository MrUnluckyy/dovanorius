import { ContentSkeleton } from "@/components/loaders/ContentSkeleton";

/** The discover layout already renders the navbar, so this fills only its main. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-8">
      <ContentSkeleton cards={9} />
    </div>
  );
}
