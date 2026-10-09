import { isAdmin, loadDeck, slideCount } from "@/lib/carousel/deck";
import { renderSlide } from "@/lib/carousel/render";

export const dynamic = "force-dynamic";

/** One carousel slide as a 1080×1350 PNG. `?price=1` adds a rough price band. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; slide: string }> }
) {
  if (!(await isAdmin())) return new Response("Forbidden", { status: 403 });

  const { id, slide } = await params;
  const deck = await loadDeck(id);
  if (!deck) return new Response("Not found", { status: 404 });

  const index = Number(slide);
  if (!Number.isInteger(index) || index < 0 || index >= slideCount(deck)) {
    return new Response("Not found", { status: 404 });
  }

  const showPrice = new URL(req.url).searchParams.get("price") === "1";
  const image = await renderSlide(deck, index, { showPrice });
  return new Response(image.body, {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
  });
}
