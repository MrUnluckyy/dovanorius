import { z } from "zod";

const UrlSchema = z
  .string()
  .trim()
  .transform<string | "">((val) => {
    // Allow empty string (no URL)
    if (!val) return "";

    // If it already has http/https – leave it
    if (/^https?:\/\//i.test(val)) return val;

    // Otherwise prepend https://
    return `https://${val}`;
  })
  .refine(
    (val) => {
      if (val === "") return true; // empty is allowed
      try {
        // Runtime URL validation
        new URL(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Netinkamas URL" }
  );

export const ItemSchema = z.object({
  title: z.string().min(1, "Reikia pavadinimo"),
  // Result type: string | "" (and because it's optional: string | "" | undefined)
  url: UrlSchema.optional(),

  notes: z.string().max(2_000).optional().or(z.literal("")),
  image_url: z.url().optional().or(z.literal("")),
  price: z
    .number("Turėtų būti skaičius")
    .positive("Gali būti tik teigiamas skaičius")
    .max(1_000_000, "Per didelė kaina")
    .optional(),
});

export type ItemFormValues = z.infer<typeof ItemSchema>;
