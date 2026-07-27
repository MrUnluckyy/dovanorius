import { redirect } from "next/navigation";

/** The AI ideas now live on the combined /discover page. */
export default function InspoPage() {
  redirect("/discover");
}
