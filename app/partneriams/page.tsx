import type { Metadata } from "next";
import Link from "next/link";
import { LuArrowRight, LuCheck } from "react-icons/lu";
import { PartnerHeader } from "@/components/partners/PartnerHeader";
import { Reveal } from "@/components/ui/Reveal";

const CONTACT = "mailto:partneriai@noriuto.lt";

export const metadata: Metadata = {
  title: "Partneriams — pasiek pirkėjus, kai jie renkasi dovanas | Noriuto",
  description:
    "Noriuto — atradimų kanalas prekės ženklams. Pristatyk savo prekes žmonėms, kurie planuoja dovanas ir dar renkasi, ką pirkti. Komisinis tik už atsektus pardavimus.",
  alternates: { canonical: "https://www.noriuto.lt/partneriams" },
};

/* ---------------------------------------------------------------- hero */
function Hero() {
  return (
    <section className="nr-container pt-10 md:pt-16">
      <div className="mx-auto max-w-[820px] text-center">
        <Reveal>
          <span className="nr-badge nr-badge-tint mb-5">
            Partneriams · Verslui
          </span>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="nr-display mb-5 text-[38px] md:text-[60px]">
            Pasiek pirkėjus tada, kai jie renkasi, ką pirkti
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="nr-lead mx-auto mb-8 max-w-[640px]">
            Noriuto — ne dar viena partnerių programa. Tai atradimų kanalas:
            žmonės čia planuoja dovanas ir pildo norų sąrašus, o mūsų
            rekomendacijos bei dovanų gidai pristato tavo prekes tada, kai
            sprendimas dar nepriimtas.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className="flex flex-col items-center justify-center gap-3.5 sm:flex-row">
            <Link href={CONTACT} className="nr-btn nr-btn-primary w-full sm:w-auto">
              Susisiekime
            </Link>
            <Link
              href="#kaip-veikia"
              className="nr-btn nr-btn-outline w-full sm:w-auto"
            >
              Kaip tai veikia
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- reframe */
function Reframe() {
  return (
    <section className="nr-container nr-section">
      <Reveal className="mx-auto mb-10 max-w-[620px] text-center">
        <span className="nr-badge nr-badge-tint mb-3.5">Kodėl verta</span>
        <h2 className="nr-h2 text-[28px] md:text-[38px]">
          Ne fiksuojame paklausą — ją kuriame
        </h2>
      </Reveal>
      <div className="grid gap-5 md:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-[24px] border border-(--nr-border) bg-white p-7">
            <div className="mb-2 text-[13px] font-bold uppercase tracking-[0.06em] text-(--nr-faint)">
              Įprasta partnerių programa
            </div>
            <p className="text-[16px] leading-relaxed text-(--nr-muted)">
              Nuoroda nukreipia pirkėją, kuris jau apsisprendė. Moki komisinį už
              pardavimą, kuris būtų įvykęs ir be tavęs.
            </p>
          </div>
        </Reveal>
        <Reveal delay={90}>
          <div className="h-full rounded-[24px] border-2 border-(--nr-yellow) bg-(--nr-tile) p-7">
            <div className="mb-2 text-[13px] font-bold uppercase tracking-[0.06em] text-(--nr-gold-strong)">
              Su Noriuto
            </div>
            <p className="text-[16px] leading-relaxed text-(--nr-ink-2)">
              Pristatome tavo prekes žmonėms, kurie dar renkasi ir yra atviri
              pasiūlymui. Generuojame naują paklausą — ne tik fiksuojame esamą.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- value props */
const VALUES = [
  {
    emoji: "🎯",
    title: "Pirkėjai su aiškiu ketinimu",
    body: "Noriuto žmonės aktyviai renkasi dovanas sau ir kitiems. Jie atviri pasiūlymams ir dažnai dar nepasirinkę prekės ženklo.",
  },
  {
    emoji: "✨",
    title: "Atradimai, ne paieška",
    body: "AI dovanų rekomendacijos ir „Atrask“ pristato tavo prekes pagal gavėjo skonį — naujiems pirkėjams, ne tik esamiems.",
  },
  {
    emoji: "📝",
    title: "Dovanų gidai ir SEO",
    body: "Redakciniai dovanų gidai su tavo prekėmis pritraukia organinį srautą ir dirba ilgai po publikavimo.",
  },
  {
    emoji: "📊",
    title: "Skaidrus atsiskaitymas",
    body: "Kiekvienas paspaudimas sekamas. Moki komisinį tik už realius, atsektus pardavimus — jokių mokesčių už rodymą.",
  },
];

function Values() {
  return (
    <section className="nr-container nr-section">
      <Reveal className="mx-auto mb-10 max-w-[620px] text-center">
        <h2 className="nr-h2 text-[28px] md:text-[38px]">
          Ką gauna prekės ženklas
        </h2>
      </Reveal>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {VALUES.map((v, i) => (
          <Reveal key={v.title} delay={i * 80}>
            <article className="nr-card h-full p-7">
              <div className="mb-3 text-[26px]">{v.emoji}</div>
              <h3 className="nr-h3 mb-2 text-[20px]">{v.title}</h3>
              <p className="text-[15px] leading-relaxed text-(--nr-muted)">
                {v.body}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------- how it works */
const STEPS = [
  {
    n: "01",
    title: "Prijunk prekes",
    body: "Integruok savo prekių srautą arba jau esamą AWIN kanalą. Prekės atsiranda „Atrask“ rekomendacijose ir dovanų giduose.",
  },
  {
    n: "02",
    title: "Žmonės atranda ir spusteli",
    body: "Rekomendacijos pristato tavo prekes tinkamu momentu. Paspaudimai nukreipiami per sekamą nuorodą į tavo parduotuvę.",
  },
  {
    n: "03",
    title: "Moki už rezultatą",
    body: "Komisinis mokamas tik už atsektus pardavimus. Aiški statistika partnerio skydelyje.",
  },
];

function HowItWorks() {
  return (
    <section id="kaip-veikia" className="nr-container nr-section scroll-mt-24">
      <Reveal className="mx-auto mb-10 max-w-[620px] text-center">
        <span className="nr-badge nr-badge-tint mb-3.5">Kaip tai veikia</span>
        <h2 className="nr-h2 text-[28px] md:text-[38px]">
          Nuo prekės srauto iki komisinio
        </h2>
      </Reveal>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 90}>
            <div className="h-full rounded-[24px] border border-(--nr-border) bg-white p-7">
              <div className="mb-4 font-heading text-[34px] font-extrabold text-(--nr-yellow-deep)">
                {s.n}
              </div>
              <h3 className="nr-h3 mb-2 text-[20px]">{s.title}</h3>
              <p className="text-[15px] leading-relaxed text-(--nr-muted)">
                {s.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- showcase */
function Showcase() {
  const products = [
    { emoji: "🎧", bg: "#FFE3A8", name: "Belaidės ausinės", price: "89 €" },
    { emoji: "🕯️", bg: "#FFF4D6", name: "Kvapni žvakė", price: "24 €" },
    { emoji: "📚", bg: "#F3EBDD", name: "Metų knyga", price: "18 €" },
    { emoji: "🧴", bg: "#FFE3A8", name: "Kosmetikos rinkinys", price: "45 €" },
  ];
  return (
    <section className="nr-container nr-section">
      <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
        <Reveal>
          <div>
            <span className="nr-badge nr-badge-tint mb-3.5">Atrask</span>
            <h2 className="nr-h2 mb-4 text-[28px] md:text-[36px]">
              Tavo prekės ten, kur ieškoma idėjų
            </h2>
            <p className="mb-6 text-[16px] leading-relaxed text-(--nr-muted)">
              Kai žmogus nežino, ką padovanoti, Noriuto pasiūlo idėjų pagal
              progą ir gavėjo skonį. Tavo prekės rodomos kontekste — su
              nuotrauka, kaina ir nuoroda į parduotuvę.
            </p>
            <ul className="flex flex-col gap-3">
              {[
                "Rekomendacijos pagal skonį ir progą",
                "Redakciniai dovanų gidai",
                "Sekamos nuorodos į tavo parduotuvę",
              ].map((p) => (
                <li
                  key={p}
                  className="flex items-center gap-2.5 text-[15px] font-semibold"
                >
                  <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-(--nr-tile) text-(--nr-gold-strong)">
                    <LuCheck className="text-[13px]" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* Discover-style mock */}
        <Reveal delay={120}>
          <div className="rounded-[28px] border border-(--nr-border) bg-white p-5 shadow-[var(--nr-shadow-hover)]">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-heading text-[18px] font-extrabold">
                🎁 Dovanų idėjos
              </span>
              <span className="nr-badge nr-badge-tint !px-2.5 !py-1 !text-[11px]">
                Gimtadieniui
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => (
                <div
                  key={p.name}
                  className="overflow-hidden rounded-2xl border border-(--nr-border) bg-white"
                >
                  <div
                    className="flex h-24 items-center justify-center text-4xl"
                    style={{ background: p.bg }}
                  >
                    {p.emoji}
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="truncate text-[13px] font-bold">
                      {p.name}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-(--nr-gold-text)">
                        {p.price}
                      </span>
                      <span className="flex items-center gap-0.5 text-[11px] font-bold text-(--nr-yellow-deep)">
                        Pirkti
                        <LuArrowRight className="text-[12px]" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- stats */
function Stats() {
  const stats = [
    { value: "604k+", label: "prekių jau kataloge" },
    { value: "AI", label: "pagrįstos rekomendacijos" },
    { value: "100%", label: "sekami paspaudimai" },
  ];
  return (
    <section className="nr-container py-4">
      <Reveal>
        <div className="grid grid-cols-1 gap-5 rounded-[28px] bg-(--nr-tile) px-6 py-9 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-heading text-[40px] font-extrabold leading-none text-(--nr-ink)">
                {s.value}
              </div>
              <div className="mt-2 text-[14px] font-semibold text-(--nr-gold-strong)">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------------------------------------------------------- cta */
function Cta() {
  return (
    <section className="nr-container pb-16 pt-8 md:pb-[70px]">
      <Reveal>
        <div className="relative overflow-hidden rounded-[32px] bg-(--nr-yellow) px-8 py-14 text-center md:px-[60px]">
          <div
            className="pointer-events-none absolute -right-14 -top-14 h-64 w-64 rounded-full bg-white/35"
            style={{ animation: "nrBobR 9s ease-in-out infinite" }}
          />
          <div className="relative mx-auto max-w-[560px]">
            <h2 className="nr-display mb-3.5 text-[32px] md:text-[44px]">
              Partneriaukime
            </h2>
            <p className="mb-7 text-[17px] leading-snug text-(--nr-on-yellow-muted)">
              Papasakok apie savo prekės ženklą — parodysime, kaip tavo prekės
              atrodys Noriuto ir kokį srautą galime pasiekti kartu.
            </p>
            <div className="flex flex-col items-center justify-center gap-3.5 sm:flex-row">
              <Link href={CONTACT} className="nr-btn nr-btn-dark w-full sm:w-auto">
                Rašyk mums
              </Link>
              <Link
                href="/partner/login"
                className="nr-btn nr-btn-outline w-full !border-transparent !bg-white hover:!bg-[#fff8ea] sm:w-auto"
              >
                Jau partneris? Prisijunk
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------- footer */
function PartnerFooter() {
  return (
    <footer className="border-t border-(--nr-border)">
      <div className="nr-container flex flex-col items-center gap-4 py-7 text-[13px] text-(--nr-faint) md:flex-row md:justify-between">
        <div className="flex items-center gap-4">
          <span>© {new Date().getFullYear()} Noriuto.lt</span>
          <Link href="/" className="transition-colors hover:text-(--nr-ink)">
            noriuto.lt
          </Link>
        </div>
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link
            href="/privatumo-politika"
            className="transition-colors hover:text-(--nr-ink)"
          >
            Privatumo politika
          </Link>
          <Link
            href="/naudojimo-politika"
            className="transition-colors hover:text-(--nr-ink)"
          >
            Naudojimo politika
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export default function PartnersPage() {
  return (
    <>
      <PartnerHeader />
      <main>
        <Hero />
        <Reframe />
        <Values />
        <HowItWorks />
        <Showcase />
        <Stats />
        <Cta />
      </main>
      <PartnerFooter />
    </>
  );
}
