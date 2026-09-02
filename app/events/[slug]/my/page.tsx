import { NavigationV2 } from "@/components/navigation/NavigationV2";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import MyRecipientClient from "../_components/MyRecipientClient";
import { isAccountUser, loginRedirect } from "@/utils/auth/account";

export default async function MyRecipientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAccountUser(user)) redirect(loginRedirect(`/events/${slug}/my`));

  return (
    <main>
      <NavigationV2 user={user} />
      <MyRecipientClient slug={slug} />
    </main>
  );
}
