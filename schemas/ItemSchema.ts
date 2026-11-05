import { z } from "zod";
import { normalizeShopUrl } from "@/utils/affiliate/outHref";

// Same rule as /out uses to open a wish link, so nothing that saves here can
// fail there. Adds https:// when missing; "noriu", "noriu.l", "https://noriu"
// and free text are rejected with a message instead of being saved.
const UrlSchema = z
  .string()
  .trim()
  .refine((val) => val === "" || normalizeShopUrl(val) !== null, {
    message: "Netinkama nuoroda. Įklijuokite visą parduotuvės nuorodą, pvz. https://www.knygos.lt/...",
  })
  .transform<string | "">((val) => (val === "" ? "" : (normalizeShopUrl(val) ?? "")));

export const ItemSchema = z.object({
  title: z.string().min(1, "Reikia pavadinimo"),
  boardId: z.uuid(),
  // Result type: string | "" (and because it's optional: string | "" | undefined)
  url: UrlSchema.optional(),

  notes: z.string().max(2_000).optional().or(z.literal("")),
  image_url: z.url().optional().or(z.literal("")),
  image_urls: z.array(z.string().url()).max(5).optional(),
  price: z
    .number("Turėtų būti skaičius")
    .positive("Gali būti tik teigiamas skaičius")
    .max(1_000_000, "Per didelė kaina")
    .optional(),
  // Infinite ("unlimited") wish: when true the wish can't be reserved.
  is_infinite: z.boolean().optional(),
});

export type ItemFormValues = z.infer<typeof ItemSchema>;
