import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/ui/Reveal";
import { Hero3D } from "@/components/ui/Hero3D";

export async function Features() {
  const t = await getTranslations("Landing.features");
  const tHow = await getTranslations("Landing.how");

  const features = [
    { img: "/assets/shoe.png", title: t("concreteTitle"), body: t("concreteBody") },
    { img: "/assets/boards.png", title: t("boardsTitle"), body: t("boardsBody") },
    { img: null, title: t("exchangeTitle"), body: t("exchangeBody") },
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
              {f.img ? (
                <img
                  src={f.img}
                  alt={f.title}
                  loading="lazy"
                  className="block h-[230px] w-full object-cover"
                />
              ) : (
                // The draw itself, in the app's 3D style — this was a stock
                // photo of hands passing a present, the one picture on the
                // page that wasn't the product.
                <div
                  className="relative flex h-[230px] flex-col items-center justify-center gap-3 bg-(--nr-tile)"
                  role="img"
                  aria-label={f.title}
                >
                  <Hero3D name="envelope" size={88} />
                  <div className="flex items-center gap-2.5 rounded-2xl bg-(--nr-surface) px-3.5 py-2 shadow-[var(--nr-shadow-hover)]">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-(--nr-yellow) font-heading text-sm font-bold">
                      {tHow("drawName").charAt(0)}
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-(--nr-gold-strong)">
                        {tHow("drawLabel")}
                      </span>
                      <span className="font-heading text-[15px] font-bold">
                        {tHow("drawName")}
                      </span>
                    </span>
                  </div>
                </div>
              )}
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
