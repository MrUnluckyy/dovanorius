// components/CategoryMasonry.tsx
import { CategoryMasinoryCard } from "./CategoryMasinoryCard";

export type Item = {
  key: string;
  title: string;
  emoji?: string;
  images: [
    { src: string; alt: string; width: number; height: number },
    { src: string; alt: string; width: number; height: number },
    { src: string; alt: string; width: number; height: number }
  ];
};

export function CategoryMasonry({
  items,
  aboveTheFoldCount = 6,
}: {
  items: Item[];
  aboveTheFoldCount?: number;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* Pinterest layout */}
      <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
        {items.map((item, i) => (
          <div key={item.key} className="mb-4 break-inside-avoid">
            <CategoryMasinoryCard
              item={item}
              priority={i < aboveTheFoldCount}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
