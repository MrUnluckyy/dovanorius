import { createHash, randomBytes } from "node:crypto";

/** How long an emailed link works. Long enough for slow mail, short if forwarded. */
export const ACCESS_LINK_MINUTES = 30;
/** One mail a minute and five an hour, per address per event. */
export const ACCESS_LINK_COOLDOWN_SECONDS = 60;
export const ACCESS_LINK_HOURLY_LIMIT = 5;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only the hash is stored, so a leaked table row cannot open anybody's event. */
export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newAccessToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashAccessToken(token) };
}
