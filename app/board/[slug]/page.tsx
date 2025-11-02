import { createClient } from "@/utils/supabase/server";
import { BoardBar } from "@/app/boards/[boardId]/components/BoardBar";
import { NavigationV2 } from "@/components/navigation/NavigationV2";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";

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
    .select("id, name, is_public, created_at, slug, description")
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
    <main>
      <NavigationV2 user={user} />
      <div className="max-w-[1440px] mx-auto min-h-screen px-4">
        <Breadcrumbs />
        <div className="py-8 mb-10">
          <BoardBar userId={user?.id} board={board} inPublicView />
        </div>

        <div className="flex">
          {(items ?? []).map((item) => (
            <div key={item.id} className="card bg-base-100 shadow-sm max-w-md">
              <figure className="max-h-52">
                <img
                  src="https://images.unsplash.com/photo-1640025867572-f6b3a8410c81?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1364"
                  alt="Gift illustration"
                />
              </figure>
              <div className="card-body">
                <h2 className="card-title">{item.title}</h2>
                <p>{item.notes}</p>
                <div className="card-actions justify-end">
                  <button className="btn btn-primary">Reserve</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
