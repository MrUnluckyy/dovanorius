import Image from "next/image";
import { Item } from "./CategoryMasinory";

export function CategoryMasinoryCard({
  item,
  priority,
}: {
  item: Item;
  priority?: boolean;
}) {
  const [big, top, bottom] = item.images;

  return (
    <div className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-md">
      {/* collage */}
      <div className="grid grid-cols-3 gap-2 p-2">
        {/* big image */}
        <div className="relative col-span-2">
          <Image
            src={big.src}
            alt={big.alt}
            width={big.width}
            height={big.height}
            priority={priority}
            sizes="(max-width:768px) 32vw, 20vw"
            className="h-auto w-full rounded-2xl object-cover"
          />
        </div>

        {/* right column */}
        <div className="flex flex-col gap-2">
          <Image
            src={top.src}
            alt={top.alt}
            width={top.width}
            height={top.height}
            priority={priority}
            sizes="(max-width:768px) 16vw, 10vw"
            className="h-auto w-full rounded-xl object-cover"
          />

          <Image
            src={bottom.src}
            alt={bottom.alt}
            width={bottom.width}
            height={bottom.height}
            priority={priority}
            sizes="(max-width:768px) 16vw, 10vw"
            className="h-auto w-full rounded-xl object-cover"
          />
        </div>
      </div>

      {/* title */}
      <div className="px-4 pb-4 pt-1">
        <div className="text-lg font-bold leading-tight">
          {item.emoji && <span className="mr-2">{item.emoji}</span>}
          {item.title}
        </div>
      </div>
    </div>
  );
}
