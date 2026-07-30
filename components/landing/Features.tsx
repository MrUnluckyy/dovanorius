import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/ui/Reveal";

export async function Features() {
  const t = await getTranslations("Landing.features");

  const features = [
    { img: "/assets/shoe.png", title: t("concreteTitle"), body: t("concreteBody") },
    { img: "/assets/boards.png", title: t("boardsTitle"), body: t("boardsBody") },
    {
      img: "/assets/gift-exchange.jpg",
      title: t("exchangeTitle"),
      body: t("exchangeBody"),
    },
  ];

  return (
    <section className="nr-container nr-section">
      <Reveal as="h2" className="nr-h2 mb-10 text-center text-[30px] md:text-[40px]">
        {t("title")}
      </Reveal>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 90}>
            <article className="nr-card nr-card-hover h-full">
              <img
                src={f.img}
                alt={f.title}
                loading="lazy"
                className="block h-[230px] w-full object-cover"
              />
              <div className="p-6 pb-7">
                <h3 className="nr-h3 mb-2 text-[21px]">{f.title}</h3>
                <p className="text-[15px] leading-relaxed text-(--nr-muted)">
                  {f.body}
                </p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
