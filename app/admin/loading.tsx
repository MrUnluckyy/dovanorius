import { ContentSkeleton } from "@/components/loaders/ContentSkeleton";

/** AdminLayout renders AdminNav and the max-w-6xl main around this. */
export default function Loading() {
  return <ContentSkeleton cards={3} />;
}
