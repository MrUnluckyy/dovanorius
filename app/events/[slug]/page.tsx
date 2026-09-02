import { NavigationV2 } from "@/components/navigation/NavigationV2";
import LobbyClient from "./_components/LobbyClient";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { isAccountUser, loginRedirect } from "@/utils/auth/account";

export default async function SsLobyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAccountUser(user)) redirect(loginRedirect(`/events/${slug}`));
  // Theme + Snowfall are applied inside LobbyClient, gated on the event type
  // (Christmas only for Secret Santa), since the type is only known after fetch.
  return (
    <main>
      <NavigationV2 user={user} />
      <LobbyClient slug={slug} user={user} />
    </main>
  );
}
