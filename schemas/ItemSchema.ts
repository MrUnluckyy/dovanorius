import { z } from "zod";

export const ItemSchema = z.object({
  title: z.string().min(1, "Reikia pavadinimo"),
  url: z.url("Netinkamas URL").optional().or(z.literal("")),
  notes: z.string().max(2_000).optional().or(z.literal("")),
  image_url: z.url().optional().or(z.literal("")),
  price: z
    .number("Enter a valid number")
    .positive("Must be > 0")
    .max(1_000_000, "Too large")
    .optional(),
});
