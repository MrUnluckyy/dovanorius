import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { ImageHero } from "@/components/hero/ImageHero";
import { Features } from "@/components/landing/Features";
import { DetailedFeatures } from "@/components/landing/DetailedFeatures";
import { Testimonials } from "@/components/landing/Testimonials";
import Footer from "@/components/footer/Footer";
import { PreFooterCTA } from "@/components/landing/PreFooterCTA";
import { Examples } from "@/components/landing/Examples";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <>
      <NavigationV2 user={user} />
      <main className="pb-20 overflow-hidden">
        <ImageHero />
        <Features />
        <DetailedFeatures />
        <Testimonials />
        <Examples />
        <PreFooterCTA />
      </main>
      <Footer />
    </>
  );
}
