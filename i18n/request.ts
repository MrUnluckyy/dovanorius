import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export default getRequestConfig(async () => {
  const store = await cookies();
  console.log("Cookies:", store.getAll());
  const locale = store.get("locale")?.value || "lt";

  return {
    locale,
    messages: (await import(`../content/messages/${locale}.json`)).default,
  };
});
