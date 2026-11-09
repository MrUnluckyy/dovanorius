import { ConsentSettingsLink } from "@/components/consent/ConsentSettingsLink";

export default function CookiesPolicyPage() {
  return (
    <>
      <h1>Slapukų politika</h1>
      <p>
        <strong>Paskutinį kartą atnaujinta: 2026 m. lapkričio mėn.</strong>
      </p>

      <p>
        Šioje slapukų politikoje paaiškiname, kokius slapukus naudojame
        svetainėje <strong>noriuto.lt</strong>, kokiu tikslu tai darome ir kaip
        galite valdyti savo pasirinkimus.
      </p>

      <h2>1. Kas yra slapukai?</h2>
      <p>
        Slapukai - tai nedidelės rinkmenos, saugomos jūsų naršyklėje. Panašiai
        veikia ir naršyklės vietinė saugykla (localStorage). Toliau „slapukais“
        vadiname abu.
      </p>

      <h2>2. Kokius slapukus naudojame?</h2>

      <h3>2.1. Būtini slapukai</h3>
      <p>
        Šie slapukai būtini svetainės veikimui, todėl jiems sutikimo
        neprašome ir jų išjungti negalima:
      </p>
      <ul>
        <li>
          <strong>sb-*</strong> (Supabase) - prisijungimo sesijai palaikyti;
          galioja, kol esate prisijungę;
        </li>
        <li>
          <strong>nr_consent</strong> - jūsų slapukų pasirinkimui įsiminti;
          galioja 12 mėn.;
        </li>
        <li>
          <strong>locale</strong> - pasirinktai svetainės kalbai įsiminti.
        </li>
      </ul>

      <h3>2.2. Analitiniai slapukai</h3>
      <p>Naudojami tik gavus jūsų sutikimą:</p>
      <ul>
        <li>
          <strong>PostHog</strong> (ph_*) - kad matytume, kaip naudojamasi
          svetaine (pvz., kurie puslapiai lankomi, kur žmonės sustoja), ir
          galėtume ją tobulinti; galioja iki 12 mėn.;
        </li>
        <li>
          <strong>Microsoft Clarity</strong> (_clck, _clsk, CLID), įkeliamas per
          Google Tag Manager - kad matytume, kaip naudojamasi puslapiais
          (paspaudimai, slinkimas); asmeniniai duomenys formose ir norų
          sąrašuose paslepiami; galioja iki 12 mėn.;
        </li>
        <li>
          <strong>nr_signup_ctx</strong> - kad žinotume, iš kur atėjo naujas
          naudotojas (pvz., iš pasidalinto norų sąrašo); galioja 30 d.
        </li>
      </ul>
      <p>
        Šie duomenys naudojami svetainės tobulinimui ir nenaudojami reklamai.
      </p>

      <h3>2.3. Rinkodaros slapukai</h3>
      <p>
        Šiuo metu rinkodaros ar reklamos slapukų nenaudojame. Jei pradėsime,
        jie bus naudojami tik gavus jūsų sutikimą, o šį pasirinkimą jūsų
        paklausime iš naujo.
      </p>

      <h2>3. Slapukų valdymas</h2>
      <p>
        Pirmą kartą apsilankę svetainėje matysite pranešimą, kuriame galite
        leisti visus slapukus arba tik būtinus.
        Kol nepasirinksite, nebūtini slapukai nenaudojami.
      </p>
      <p>
        Pasirinkimą galite bet kada pakeisti arba atšaukti per nuorodą
        „Slapukų nustatymai“ puslapio apačioje arba čia:{" "}
        <ConsentSettingsLink className="font-semibold underline underline-offset-2" />
        . Atšaukus sutikimą, analitiniai slapukai iš jūsų naršyklės
        ištrinami. Jūsų pasirinkimo paklausime iš naujo po 12 mėn. arba
        pradėję naudoti naują įrankį.
      </p>

      <h2>4. Slapukų išjungimas naršyklėje</h2>
      <p>
        Slapukus taip pat galite ištrinti arba blokuoti savo naršyklės
        nustatymuose. Atkreipiame dėmesį, kad išjungus būtinus slapukus dalis
        svetainės funkcijų gali neveikti tinkamai.
      </p>

      <h2>5. Slapukų politikos pakeitimai</h2>
      <p>
        Ši slapukų politika gali būti atnaujinama. Naujausia versija visada bus
        skelbiama svetainėje noriuto.lt, nurodant atnaujinimo datą.
      </p>
    </>
  );
}
