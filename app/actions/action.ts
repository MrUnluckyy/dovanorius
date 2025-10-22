// app/actions.ts
"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setLocale(formData: FormData) {
  console.log("🌍 Setting locale...", formData);
  const locale = String(formData.get("locale") || "en");
  const store = await cookies();
  store.set("locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  // Re-render current pages using the new cookie
  revalidatePath("/", "layout"); // or a more specific path if you want
}
