import { ProseSkeleton } from "@/components/loaders/ContentSkeleton";

/** The legal layout supplies the navbar, card and prose container. */
export default function Loading() {
  return <ProseSkeleton lines={16} />;
}
