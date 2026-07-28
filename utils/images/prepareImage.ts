// Single entry point for turning a user-picked image File into a small,
// web-safe file ready for upload. Two jobs:
//   1. Fix iPhone photos — HEIC/HEIF, which Chrome/Firefox can't decode, so the
//      old canvas-based compression produced broken images. We decode to JPEG
//      first via `heic-to`.
//   2. Standardise compression/resize across every upload path (previously the
//      same options were copy-pasted in 4 places, and some paths uploaded raw).
//
// The heavy deps (`heic-to`, `browser-image-compression`) are dynamically
// imported inside the function so they never touch the initial bundle — they
// load only when a user actually picks a file.

export type PrepareImageOptions = {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  /** JPEG quality for the HEIC decode step (0–1). */
  heicQuality?: number;
  /**
   * Force an output format (e.g. "image/jpeg" for avatars). When omitted the
   * original format is preserved (so PNG transparency survives) — except HEIC,
   * which is always decoded to JPEG regardless.
   */
  outputType?: string;
};

const DEFAULTS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1600,
  heicQuality: 0.9,
};

function isHeicLike(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    type === "image/heif-sequence" ||
    // Some OSes/browsers report an empty MIME type for HEIC — fall back to ext.
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

export async function prepareImageForUpload(
  file: File,
  options: PrepareImageOptions = {}
): Promise<File> {
  const opts = { ...DEFAULTS, ...options };
  let working: File = file;

  // 1) HEIC/HEIF → JPEG. Only Safari can decode HEIC in <canvas>/<img>, so we
  // convert on every browser to keep behaviour consistent.
  if (isHeicLike(file)) {
    try {
      const { heicTo } = await import("heic-to");
      const jpegBlob = await heicTo({
        blob: file,
        type: "image/jpeg",
        quality: opts.heicQuality,
      });
      working = new File(
        [jpegBlob],
        file.name.replace(/\.(heic|heif)$/i, ".jpg"),
        { type: "image/jpeg" }
      );
    } catch (err) {
      // Fall through with the original file — better to attempt the upload than
      // to hard-fail; the compression step or server may still cope.
      console.error("HEIC conversion failed, using original file:", err);
    }
  }

  // 2) Resize + compress.
  try {
    const imageCompression = (await import("browser-image-compression")).default;
    const compressed = await imageCompression(working, {
      maxSizeMB: opts.maxSizeMB,
      maxWidthOrHeight: opts.maxWidthOrHeight,
      useWebWorker: true,
      ...(opts.outputType ? { fileType: opts.outputType } : {}),
    });
    return compressed as File;
  } catch (err) {
    console.error("Image compression failed, using uncompressed file:", err);
    return working;
  }
}

/** Convenience wrapper for the multi-image forms. */
export async function prepareImages(
  files: File[] | FileList,
  options?: PrepareImageOptions
): Promise<File[]> {
  return Promise.all(
    Array.from(files).map((f) => prepareImageForUpload(f, options))
  );
}
