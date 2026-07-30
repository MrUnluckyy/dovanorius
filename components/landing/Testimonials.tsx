import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/ui/Reveal";

function Card({
  t,
}: {
  t: { name: string; role: string; imageUrl: string; quote: string };
}) {
  return (
    <figure className="w-[340px] flex-none rounded-[24px] border border-(--nr-border) bg-white p-7 sm:w-[400px]">
      <div className="mb-3.5 text-base tracking-[2px] text-(--nr-yellow-deep)">
        ★★★★★
      </div>
      <blockquote className="mb-5 text-[15px] leading-relaxed text-(--nr-ink-2)">
        „{t.quote}“
      </blockquote>
      <figcaption className="flex items-center gap-3">
        <Image
          src={t.imageUrl}
          alt={t.name}
          width={42}
          height={42}
          className="h-[42px] w-[42px] rounded-full object-cover"
        />
        <div>
          <div className="text-[14.5px] font-bold">{t.name}</div>
          <div className="text-[13px] text-(--nr-faint)">{t.role}</div>
        </div>
      </figcaption>
    </figure>
  );
}

export async function Testimonials() {
  const t = await getTranslations("Landing.testimonials");

  const testimonials = [
    {
      name: "Austėja Rimkė",
      role: t("roleAusteja"),
      imageUrl: "/assets/images/austeja.jpg",
      quote: t("quoteAusteja"),
    },
    {
      name: "Gintarė Katkutė-Lackė",
      role: t("roleGintare"),
      imageUrl: "/assets/images/gintare.jpg",
      quote: t("quoteGintare"),
    },
    {
      name: "Armandas Dargis",
      role: t("roleArmandas"),
      imageUrl: "/assets/images/armandas.jpg",
      quote: t("quoteArmandas"),
    },
    {
      name: "Tomas Rimkus",
      role: t("roleTomas"),
      imageUrl: "/assets/images/tomas.jpg",
      quote: t("quoteTomas"),
    },
    {
      name: "Kornelija Sobutienė",
      role: t("roleKornelija"),
      imageUrl: "/assets/images/kornelija.jpg",
      quote: t("quoteKornelija"),
    },
  ];

  const items = [...testimonials, ...testimonials];

  return (
    <section
      id="atsiliepimai"
      className="scroll-mt-24 overflow-hidden py-14 md:py-16"
    >
      <Reveal as="h2" className="nr-h2 mb-10 text-center text-[30px] md:text-[40px]">
        {t("title")}
      </Reveal>
      <div className="nr-marquee-mask overflow-hidden">
        <div className="nr-marquee group flex w-max gap-5 hover:[animation-play-state:paused]">
          {items.map((item, i) => (
            <Card key={`${item.name}-${i}`} t={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
