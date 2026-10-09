import { zipSync } from "fflate";
import { isAdmin, loadDeck, slideCount } from "@/lib/carousel/deck";
import { renderSlide } from "@/lib/carousel/render";
import { buildCaption } from "@/lib/carousel/copy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Every slide plus caption.txt, zipped, named in posting order. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  const deck = await loadDeck(id);
  if (!deck) return new Response("Not found", { status: 404 });

  const showPrice = new URL(req.url).searchParams.get("price") === "1";
  const pngs = await Promise.all(
    Array.from({ length: slideCount(deck) }, async (_, i) => {
      const res = await renderSlide(deck, i, { showPrice });
      return new Uint8Array(await res.arrayBuffer());
    })
  );

  const files: Record<string, Uint8Array> = {};
  pngs.forEach((png, i) => {
    files[`${String(i + 1).padStart(2, "0")}.png`] = png;
  });
  // The default copy; edits made in the dialog are copied from there instead.
  files["caption.txt"] = new TextEncoder().encode(
    buildCaption(
      deck.title,
      deck.description,
      deck.products.map((p) => ({ name: p.name, brand: p.brand }))
    )
  );

  // PNGs are already compressed; level 0 just stores them.
  const zip = zipSync(files, { level: 0 });
  const slug = deck.title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return new Response(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="instagram-${slug || "karusele"}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
