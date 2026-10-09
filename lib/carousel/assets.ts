import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * Fonts, logo and product photos for the carousel renderer.
 *
 * Satori (next/og) reads TTF but not WOFF2, and cannot decode WebP or AVIF at
 * all — which is what half the merchant CDNs serve. So every photo is pulled
 * through sharp and handed over as a PNG/JPEG data URI, never as a URL.
 */

const FONT_DIR = path.join(process.cwd(), "lib/carousel/fonts");

type Font = {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 800;
  style: "normal";
};

let fontsPromise: Promise<Font[]> | null = null;

export function loadFonts(): Promise<Font[]> {
  fontsPromise ??= Promise.all(
    (
      [
        ["Bricolage", "BricolageGrotesque-SemiBold.ttf", 600],
        ["Bricolage", "BricolageGrotesque-ExtraBold.ttf", 800],
        ["Instrument", "InstrumentSans-Regular.ttf", 400],
        ["Instrument", "InstrumentSans-SemiBold.ttf", 600],
      ] as const
    ).map(async ([name, file, weight]) => ({
      name,
      data: await readFile(path.join(FONT_DIR, file)),
      weight,
      style: "normal" as const,
    }))
  );
  return fontsPromise;
}

let logoPromise: Promise<string> | null = null;

export function loadLogo(): Promise<string> {
  logoPromise ??= readFile(path.join(process.cwd(), "public/assets/logo.png"))
    .then((buf) => sharp(buf).resize(160, 160).png().toBuffer())
    .then((buf) => `data:image/png;base64,${buf.toString("base64")}`);
  return logoPromise;
}

export type SlideImage = {
  src: string;
  width: number;
  height: number;
  /** A photo with its own scenery (not a packshot on white): fill the card
   *  edge to edge instead of floating it in a white frame. */
  fill: boolean;
};

// A preview opens ten slide requests at once and each needs the same photos;
// sharing the in-flight promise means each photo is fetched once, not ten times.
const imageCache = new Map<string, Promise<SlideImage | null>>();
const IMAGE_CACHE_MAX = 120;

export function loadProductImage(url: string | null): Promise<SlideImage | null> {
  if (!url || !/^https?:\/\//i.test(url)) return Promise.resolve(null);
  let hit = imageCache.get(url);
  if (!hit) {
    hit = fetchImage(url);
    imageCache.set(url, hit);
    if (imageCache.size > IMAGE_CACHE_MAX) {
      imageCache.delete(imageCache.keys().next().value!);
    }
    // A failure is worth retrying on the next press, not caching.
    hit.then((img) => {
      if (!img) imageCache.delete(url);
    });
  }
  return hit;
}

async function fetchImage(url: string): Promise<SlideImage | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        // Some merchant CDNs refuse requests that do not look like a browser.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36",
        Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
      },
    });
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());

    const fill = !(await hasPlainCorners(input));
    let pipeline = sharp(input, { failOn: "none" }).rotate();
    // Packshots usually sit in a wide white margin; trimming it lets every
    // product fill its card the same way. Lifestyle photos have no uniform
    // border, so trim leaves them alone.
    try {
      const trimmed = await pipeline.clone().trim({ threshold: 12 }).toBuffer();
      pipeline = sharp(trimmed);
    } catch {
      // A completely uniform image cannot be trimmed; use it as is.
    }

    const meta = await pipeline.metadata();
    const out = pipeline.resize(1000, 1000, { fit: "inside", withoutEnlargement: true });
    const buf = meta.hasAlpha
      ? await out.png().toBuffer()
      : await out.jpeg({ quality: 88 }).toBuffer();
    const { width = 1, height = 1 } = await sharp(buf).metadata();
    const mime = meta.hasAlpha ? "image/png" : "image/jpeg";
    return { src: `data:${mime};base64,${buf.toString("base64")}`, width, height, fill };
  } catch {
    return null;
  }
}

/** True when all four corners are near-white or transparent — a packshot. */
async function hasPlainCorners(input: Buffer): Promise<boolean> {
  const N = 24;
  const { data } = await sharp(input, { failOn: "none" })
    .rotate()
    .resize(N, N, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => data.subarray((y * N + x) * 4, (y * N + x) * 4 + 4);
  return [px(0, 0), px(N - 1, 0), px(0, N - 1), px(N - 1, N - 1)].every(
    ([r, g, b, a]) => a < 40 || (r > 232 && g > 232 && b > 232)
  );
}
