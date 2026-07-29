import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import MyRecipientClient from "../_components/MyRecipientClient";

export default async function MyRecipientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { slug } = await params;

  return (
    <main>
      <NavigationV2 user={user} />
      <MyRecipientClient slug={slug} />
    </main>
  );
}
