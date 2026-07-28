import { VisualEditing } from "next-sanity/visual-editing";
import { draftMode } from "next/headers";

import Footer from "@/components/footer/Footer";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { SanityLive } from "@/sanity/live";
import { createClient } from "@/utils/supabase/server";

/**
 * Blog pages get the same chrome as the rest of the site. Live updates and
 * click-to-edit are scoped here rather than the root layout, so the rest of the
 * app doesn't pay for polling it never uses.
 */
export default async function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { isEnabled: isDraftMode } = await draftMode();

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20">{children}</main>
      <Footer />

      <SanityLive />
      {isDraftMode && (
        <>
          <VisualEditing />
          <a
            href="/api/draft-mode/disable"
            className="btn btn-sm btn-warning fixed bottom-4 left-4 z-50 shadow-lg"
          >
            Exit preview
          </a>
        </>
      )}
    </>
  );
}
