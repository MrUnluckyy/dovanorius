import { NavigationV2 } from "@/components/navigation/NavigationV2";
import LobbyClient from "./_components/LobbyClient";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function SsLobyPage({
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
      <LobbyClient slug={slug} user={user} />
    </main>
  );
}
