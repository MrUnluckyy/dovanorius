import crypto from "crypto";

// Signed capability token for one-click "keep / release" reservation links
// sent by email. The token grants the holder the ability to keep or release a
// specific reservation without logging in, and expires on its own.

const SECRET = process.env.RESERVATION_LINK_SECRET;

function hmac(data: string): string {
  if (!SECRET) throw new Error("RESERVATION_LINK_SECRET is not set");
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function signReservationToken(itemId: string, ttlDays = 35): string {
  const payload = {
    i: itemId,
    e: Math.floor(Date.now() / 1000) + ttlDays * 86400,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${hmac(data)}`;
}

export function verifyReservationToken(token: string): { itemId: string } | null {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;

    const expected = hmac(data);
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (typeof payload.e !== "number" || payload.e < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { itemId: payload.i as string };
  } catch {
    return null;
  }
}
