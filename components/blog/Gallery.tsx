import { stegaClean } from "next-sanity";

import SanityImage, { type SanityImageValue } from "@/components/SanityImage";

type GalleryImage = SanityImageValue & { _key: string; caption?: string };

const COLUMN_CLASSES: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export default function Gallery({
  value,
}: {
  value: {
    images?: GalleryImage[] | null;
    display?: string;
    columns?: number;
  };
}) {
  const images = value?.images?.filter((image) => image?.asset) ?? [];
  if (images.length === 0) return null;

  const display = stegaClean(value.display) === "carousel" ? "carousel" : "grid";

  if (display === "carousel") {
    return (
      // DaisyUI's carousel is pure CSS scroll-snap — no client JS needed.
      <div className="carousel rounded-box my-8 w-full gap-4 sm:-mx-12 lg:-mx-24">
        {images.map((image) => (
          <figure key={image._key} className="carousel-item w-4/5 flex-col sm:w-1/2">
            <SanityImage
              value={image}
              width={800}
              sizes="(max-width: 640px) 80vw, 50vw"
              className="rounded-box h-auto w-full"
            />
            {image.caption && (
              <figcaption className="mt-2 text-sm opacity-70">
                {image.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    );
  }

  const columns = COLUMN_CLASSES[stegaClean(value.columns) ?? 3] ?? COLUMN_CLASSES[3];

  return (
    <div className={`my-8 grid grid-cols-1 gap-4 sm:-mx-12 lg:-mx-24 ${columns}`}>
      {images.map((image) => (
        <figure key={image._key}>
          <SanityImage
            value={image}
            width={600}
            sizes="(max-width: 640px) 100vw, 33vw"
            className="rounded-box h-auto w-full"
          />
          {image.caption && (
            <figcaption className="mt-2 text-sm opacity-70">
              {image.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
