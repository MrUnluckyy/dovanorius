import Footer from "@/components/footer/Footer";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { createClient } from "@/utils/supabase/server";

/** Discover (inspo feed) gets the same chrome as the rest of the site. */
export default async function DiscoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20">{children}</main>
      <Footer />
    </>
  );
}
