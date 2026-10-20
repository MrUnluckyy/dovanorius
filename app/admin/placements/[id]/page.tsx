import { notFound } from "next/navigation";
import { requireAdmin } from "@/app/admin/_lib/requireAdmin";
import { loadPlacement } from "../_lib/load";
import { PlacementForm } from "../_components/PlacementForm";

export const dynamic = "force-dynamic";

/** /admin/placements/new creates; /admin/placements/<id> edits. */
export default async function AdminPlacementPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (id === "new") return <PlacementForm placement={null} products={[]} />;

  const loaded = await loadPlacement(id);
  if (!loaded) notFound();
  return <PlacementForm placement={loaded.row} products={loaded.products} />;
}
