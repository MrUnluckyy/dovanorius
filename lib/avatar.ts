// Avatar helper. Falls back to a deterministic smiling avatar (DiceBear
// "big-smile") seeded by a stable string, so guests without a profile picture
// get a friendly face instead of a random photo.

export function avatarUrl(
  avatar: string | null | undefined,
  seed: string | null | undefined
): string {
  if (avatar) return avatar;
  const s = encodeURIComponent((seed ?? "").trim() || "noriuto-guest");
  return `https://api.dicebear.com/9.x/big-smile/svg?seed=${s}`;
}
