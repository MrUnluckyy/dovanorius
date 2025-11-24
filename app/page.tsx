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
        <div
          role="alert"
          className="alert alert-warning max-w-[1440px] md:mx-auto my-4 mx-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 className="text-lg">Atsiprašome dėl sutrikimų</h3>
            <p>
              Šiuo metu gali pasitaikyti problemų jungiantis prie platformos dėl
              nenumatytų techninių nesklandumų. Mūsų komanda jau žino apie
              situaciją ir dirba, kad viskas būtų kuo greičiau atkurta. Ačiū už
              kantrybę ir supratingumą. Jei turite klausimų — drąsiai rašykite.
            </p>
          </div>
        </div>

        <ImageHero />

        <HowItWorks />
        <Benefits />
      </main>
      <Footer />
    </>
  );
}
