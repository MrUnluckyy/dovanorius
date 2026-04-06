import { getTranslations } from "next-intl/server";
import Image from "next/image";
import React from "react";
import { FaRegThumbsUp } from "react-icons/fa6";
import { TestimonialsCarousel } from "./TestimonialsCarousel";

const testimonials = [
  {
    name: "Tomas Rimkus",
    imageUrl: "/assets/images/tomas.jpg",
    quote:
      "Esu is tu, kurie siandien labai kazko nori, o po savaitės jau net neprisimena ko. Sitas appsas realiai gelbsti nuo mano pacio smegenu. Primena, ko noriu as - o dar geriau, ko nori kiti. Jokiu daugiau 'o ka cia dabar pirkt?' Is esmes - tai mano smegenys, tik veikiancios.",
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
      "Man kaip studentui norai dazniausiai ir lieka tik norais. Bet pradejus naudotis noriuto.lt, dovanos, kuriu is tikruju noriu, pagaliau tapo realybe. Artimieji nustebina mazomis, bet labai lauktomis dovanomis, kurios tikrai praskaidrina diena.",
  },
  {
    name: "Austėja Rimkė",
    imageUrl: "/assets/images/austeja.jpg",
    quote:
      "Esu praktiškas žmogus, nemėgstu gauti dovanų, kurių man nereikia, bet dabar, kai kas nors paklausia, ko norėčiau - nusiunčiu savo noriuto.lt norų lentą ir žinau, kad gausiu kažką, ko tikrai noriu.",
  },
  {
    name: "Gintare Katkute - Lacke",
    imageUrl: "/assets/images/gintare.jpg",
    quote:
      "Kai atsirado kūdikis, supratom, kad dovanos tampa ne tik mielos, bet ir labai praktiškos. Su noriuto.lt galim paprastai pasidalinti, ko iš tikrųjų reikia, ir išvengti bereikalingų daiktų. Mažiau chaoso, daugiau tikro džiaugsmo.",
  },
];

function TestimonialCard({ testimonial, recommend }: { testimonial: (typeof testimonials)[0]; recommend: string }) {
  return (
    <div className="w-80 shrink-0 lg:w-96">
      <div className="card card-border shadow bg-base-100 h-full">
        <div className="card-body">
          <div className="flex gap-2 items-center text-sm text-accent font-semibold">
            <FaRegThumbsUp size={18} />
            <span>{recommend}</span>
          </div>
          <p className="mb-4">{testimonial.quote}</p>
          <div className="flex items-center gap-2 mt-auto">
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
  );
}

export async function Testimonials() {
  const t = await getTranslations("HomePage");
  const recommend = t("recommend");
  const marqueeItems = [...testimonials, ...testimonials];

  return (
    <section className="relative py-8 pt-20 overflow-hidden">
      <h2 className="text-4xl md:text-5xl font-heading text-center font-bold mb-14">
        {t("testimonialsTitle")}
      </h2>

      {/* Mobile & tablet: auto-scrolling, draggable with finger */}
      <div className="lg:hidden">
        <TestimonialsCarousel items={marqueeItems} recommend={recommend} />
      </div>

      {/* Desktop: scrolling marquee */}
      <div className="hidden lg:block group w-full">
        <div className="flex w-max gap-8 motion-safe:animate-marquee group-hover:[animation-play-state:paused]">
          {marqueeItems.map((testimonial, i) => (
            <TestimonialCard
              key={`${testimonial.name}-${i}`}
              testimonial={testimonial}
              recommend={recommend}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
