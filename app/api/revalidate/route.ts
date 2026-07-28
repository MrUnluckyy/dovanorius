import { parseBody } from "next-sanity/webhook";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

type WebhookPayload = { tags?: string[] };

/**
 * Sanity webhook target. Without it, blog edits take up to the 300s ISR window
 * to appear. Configure in Sanity Manage → API → Webhooks:
 *   URL:        <site>/api/revalidate
 *   Filter:     _type in ["post", "author", "category"]
 *   Projection: {"tags": [_type, _type + ":" + slug.current]}
 *   Secret:     SANITY_REVALIDATE_SECRET
 */
export async function POST(req: NextRequest) {
  try {
    const { isValidSignature, body } = await parseBody<WebhookPayload>(
      req,
      process.env.SANITY_REVALIDATE_SECRET,
      // Delay slightly so the Sanity CDN has caught up before we refetch.
      true
    );

    if (!isValidSignature) {
      return new Response("Invalid signature", { status: 401 });
    }
    if (!Array.isArray(body?.tags) || body.tags.length === 0) {
      return new Response("Missing tags", { status: 400 });
    }

    body.tags.forEach((tag) => revalidateTag(tag));

    return NextResponse.json({ revalidated: body.tags });
  } catch (error) {
    return new Response((error as Error).message, { status: 500 });
  }
}
