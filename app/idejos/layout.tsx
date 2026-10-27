import Footer from "@/components/footer/Footer";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { createClient } from "@/utils/supabase/server";
import { getVisitor } from "@/lib/discover/visitor.server";
import { DiscoverNav } from "./_components/hub/DiscoverNav";

/**
 * Discover gets the site chrome plus its own sticky bar (recipient tabs and
 * categories). The bar lives here rather than in each page so it persists
 * across /discover/* navigations; it hides itself on browse and shop pages.
 */
export default async function DiscoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { visitor } = await getVisitor();

  return (
    <>
      <NavigationV2 user={user} />
      <DiscoverNav gender={visitor.gender} />
      <main className="pb-20">{children}</main>
      <Footer />
    </>
  );
}
