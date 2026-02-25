"use client";
import { useTranslations } from "next-intl";
import Image from "next/image";
import React from "react";
import { FaRegThumbsUp } from "react-icons/fa6";

const testimonials = [
  {
    name: "Tomas Rimkus",
    imageUrl: "/assets/images/tomas.jpg",
    quote:
      "Esu iš tų, kurie šiandien labai kažko nori, o po savaitės jau net neprisimena ko. Šitas appsas realiai gelbsti nuo mano pačio smegenų. Primena, ko noriu aš — o dar geriau, ko nori kiti. Jokių daugiau “o ką čia dabar pirkt?“ Iš esmės — tai mano smegenys, tik veikiančios.",
  },
  {
    name: "Kornelija Sobutienė",
    imageUrl: "/assets/images/kornelija.jpg",
    quote:
      "Noriuto, tai įrankis, kuris padeda kaupti visus mažiausius ir didžiausius savo norus vienoje vietoje. Norai lieka neužmiršti, o priešingai - išpildyti dėka kitų arba savęs pačio.",
  },
  {
    name: "Armandas Dargis",
    imageUrl: "/assets/images/armandas.jpg",
    quote:
      "Latogi platforma, kur gali parodyti draugams ir artimiesiems, kokių dovanų norėtum artėjančia proga ar bet kada. Tai padeda išvengti nereikalingų ar mažai naudojamų dovanų. Čia gali ne tik dalintis norimomis dovanomis, bet ir susirašyti, ko apskritai trūksta, pavyzdžiui, namų reikmenų. O geriausia - savo lentas gali kurti bendras su draugais ar šeima.",
  },
  {
    name: "Gintare Katkute - Lacke",
    imageUrl: "/assets/images/gintare.jpg",
    quote:
      "Noriuto.lt yra labai naudinga platforma, ypač turint kūdikį. Artimieji gali tiksliai žinoti, ko jums reikia, todėl nedovanoja nereikalingų daiktų, kurie vėliau tiesiog guli spintose.",
  },
  {
    name: "Austėja Rimkė",
    imageUrl: "/assets/images/austeja.jpg",
    quote:
      "Esu praktiškas žmogus, nemėgstu gauti dovanų, kurių man nereikia, bet dabar, kai kas nors paklausia, ko norėčiau - nusiunčiu savo noriuto.lt norų lentą ir žinau, kad gausiu kažką, ko tikrai noriu. Taip pat programėlę naudoju ir kaip savo “wish list”, kai kažko užsimanau - įsidedu jį čia ir atėjus laikui, pati sau nusiperku. Mažesnis galvos skausmas ir kai kitiems reikia pirkti dovaną, visi draugai prisijungė prie noriuto.lt ir dabar nebereikia sukti galvos ar dovanoti kažko nenaudingo, visi gauna, ką įsideda į savo wish list'ą!",
  },
];

export function Testimonials() {
  const t = useTranslations("HomePage");

  // IMPORTANT: testimonials should be unique (e.g. 2–6 real ones)
  const items = [...testimonials, ...testimonials];

  return (
    <section className="relative py-8 pt-20 overflow-hidden">
      <h2 className="text-5xl font-heading text-center font-bold mb-14">
        {t("testimonialsTitle")}
      </h2>

      <div className="group w-full">
        <div
          className="
              flex w-max gap-8
              motion-safe:animate-marquee
              group-hover:[animation-play-state:paused]
            "
        >
          {items.map((testimonial, i) => (
            <div key={`${testimonial.name}-${i}`} className="w-96 shrink-0">
              <div className="card card-border shadow bg-base-100">
                <div className="card-body">
                  <div className="flex gap-2 items-center text-sm text-accent font-semibold">
                    <FaRegThumbsUp size={18} />
                    <span>{t("recommend")}</span>
                  </div>

                  <p className="mb-4 line-clamp-6">{testimonial.quote}</p>

                  <div className="flex items-center gap-2">
                    <div className="avatar">
                      <div className="w-8 rounded-full">
                        <Image
                          src={testimonial.imageUrl}
                          alt={testimonial.name}
                          width={48}
                          height={48}
                        />
                      </div>
                    </div>
                    <span className="font-bold">{testimonial.name}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
