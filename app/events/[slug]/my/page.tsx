import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { loginRedirect } from "@/utils/auth/account";
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

  const { slug } = await params;
  if (!user)
    redirect(loginRedirect(`/events/${slug}/my`));

  return (
    <main className="min-h-screen bg-(--nr-cream)">
      <NavigationV2 user={user} />
      <MyRecipientClient slug={slug} />
    </main>
  );
}
