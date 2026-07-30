import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { LandingHeader } from "@/components/landing/LandingHeader";
import { ImageHero } from "@/components/hero/ImageHero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { DetailedFeatures } from "@/components/landing/DetailedFeatures";
import { Occasions } from "@/components/landing/Occasions";
import { IdeasStrip } from "@/components/landing/IdeasStrip";
import Footer from "@/components/footer/Footer";
import { PreFooterCTA } from "@/components/landing/PreFooterCTA";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://www.noriuto.lt",
  },
};

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
      <LandingHeader />
      {/* NOTE: no overflow-hidden here — it would break the sticky scrollytelling
          in HowItWorks. Sections that need clipping (hero collage, marquee) clip
          themselves. */}
      <main>
        <ImageHero />
        <Features />
        <HowItWorks />
        <DetailedFeatures />
        <Occasions />
        <IdeasStrip />
        <PreFooterCTA />
      </main>
      <Footer />
    </>
  );
}
