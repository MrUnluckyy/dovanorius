import { loadShelves, loadPicks } from "./_lib/health";
import { summarise, scheduleState } from "./_lib/types";
import {
  EditorialListClient,
  type ShelfRow,
} from "./_components/EditorialListClient";
import { requireAdmin } from "@/app/admin/_lib/requireAdmin";

export const dynamic = "force-dynamic";

export default async function AdminEditorialPage() {
  await requireAdmin();
  const shelves = await loadShelves();
  const picksByShelf = await loadPicks(shelves.map((s) => s.id));

  const rows: ShelfRow[] = shelves.map((s) => ({
    ...s,
    health: summarise(picksByShelf.get(s.id) ?? []),
    schedule: scheduleState(s),
  }));

  return <EditorialListClient shelves={rows} />;
}
