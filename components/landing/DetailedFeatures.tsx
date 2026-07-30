import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/ui/Reveal";

export async function DetailedFeatures() {
  const t = await getTranslations("Landing.tiles");

  const tiles = [
    { emoji: "🔄", title: t("syncTitle"), body: t("syncBody") },
    { emoji: "🔒", title: t("privacyTitle"), body: t("privacyBody") },
    { emoji: "📲", title: t("shareTitle"), body: t("shareBody") },
  ];

  return (
    <section className="nr-container py-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {tiles.map((tile, i) => (
          <Reveal key={tile.title} delay={i * 90}>
            <article className="nr-tile h-full p-7">
              <div className="mb-3 text-[26px]">{tile.emoji}</div>
              <h3 className="nr-h3 mb-2 text-[19px]">{tile.title}</h3>
              <p className="text-[14.5px] leading-relaxed text-(--nr-muted)">
                {tile.body}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
