import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import ReserveButton from "../components/ReserveButton";

export default async function PublicBoardPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch board by slug when is_public = true
  const { data: board, error: bErr } = await supabase
    .from("boards")
    .select("id, name, is_public")
    .eq("slug", params.slug)
    .eq("is_public", true)
    .single();

  if (!board || bErr) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-xl font-semibold">Board not found</h1>
      </main>
    );
  }

  const filter = user?.id
    ? `reserved_by.is.null,reserved_by.eq.${user.id}`
    : `reserved_by.is.null`;

  // Hide items that are already reserved/purchased for other visitors
  const { data: items } = await supabase
    .from("items")
    .select("id,title,notes,url,status,priority,created_at,reserved_by")
    .eq("board_id", board.id)
    .or(filter)
    .order("created_at", { ascending: false });

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">{board.name}</h1>
        <Link href="/" className="text-sm underline">
          Back
        </Link>
      </header>

      <ul className="divide-y border rounded">
        {(items ?? []).map((it) => (
          <li key={it.id} className="p-3">
            <a
              href={it.url ?? "#"}
              target={it.url ? "_blank" : undefined}
              className="font-medium underline decoration-dotted"
            >
              {it.title}
            </a>
            {it.notes && (
              <p className="text-sm text-gray-600 mt-1">{it.notes}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {it.priority} · {new Date(it.created_at).toLocaleDateString()}
            </p>
            <ReserveButton itemId={it.id} />
          </li>
        ))}
        {(items ?? []).length === 0 && (
          <li className="p-3 text-sm text-gray-500">No available items</li>
        )}
      </ul>
    </main>
  );
}
