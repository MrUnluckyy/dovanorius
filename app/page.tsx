import Footer from "@/components/footer/Footer";
import { ImageHero } from "@/components/hero/ImageHero";
import HowItWorks from "@/components/landing/HowItWorks";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { createClient } from "@/utils/supabase/server";
import Benefits from "@/components/landing/Benefits";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20 overflow-hidden">
        <ImageHero />

        <HowItWorks />
        <Benefits />
      </main>
      <Footer />
    </>
  );
}
