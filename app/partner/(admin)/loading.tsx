import { ContentSkeleton } from "@/components/loaders/ContentSkeleton";

/** PartnerAdminLayout renders PartnerNav and the main around this. */
export default function Loading() {
  return <ContentSkeleton cards={3} />;
}
