/**
 * TradeDoubler publisher transactions (connect.tradedoubler.com).
 *
 * OAuth password grant: the API client (TRADEDOUBLER_CLIENT_ID/SECRET, made
 * by the account owner under Tools → API Info) only allows "password", so a
 * TradeDoubler user signs in too — a dedicated API user
 * (TRADEDOUBLER_USERNAME/PASSWORD), not the owner's own login. Tokens last
 * 15 minutes, plenty for one sync.
 *
 * GET /publisher/report/transactions?fromDate=YYYYMMDD&toDate=YYYYMMDD
 * &limit&offset — at most 365 days per call; amounts in the report currency
 * (EUR). epi = the sub id /out puts in epi(...).
 */
import { num, windows, type AffiliateSale } from "./types";

type TdTx = {
  transactionId: number;
  programId: number;
  programName: string;
  status: "P" | "A" | "D" | string;
  paid: boolean;
  orderValue: number | null;
  commission: number | null;
  epi: string | null;
  timeOfLastClick: string | null;
  timeOfTransaction: string;
  timeOfLastModified: string | null;
};

const BASE = "https://connect.tradedoubler.com";
const PAGE = 100;

/** "2026-11-24T10:00:28.000+0200" → "+02:00", which Date and Postgres both read. */
const isoTz = (s: string | null) => (s ? s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2") : null);
const ymd = (d: Date) => d.toISOString().slice(0, 10).replaceAll("-", "");

async function token(): Promise<string> {
  const { TRADEDOUBLER_CLIENT_ID: id, TRADEDOUBLER_CLIENT_SECRET: secret, TRADEDOUBLER_USERNAME: username, TRADEDOUBLER_PASSWORD: password } =
    process.env;
  if (!id || !secret || !username || !password) {
    throw new Error("TRADEDOUBLER_CLIENT_ID / _CLIENT_SECRET / _USERNAME / _PASSWORD not set");
  }
  const res = await fetch(`${BASE}/uaa/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "password", username, password }),
  });
  const body = await res.json().catch(() => null);
  // TradeDoubler answers a wrong user or password with a 500 server_error.
  if (!res.ok || !body?.access_token) throw new Error(`TradeDoubler login ${res.status}: check the API user's password`);
  return body.access_token as string;
}

export async function fetchTradedoublerSales(from: Date, to: Date): Promise<AffiliateSale[]> {
  const headers = { Authorization: `Bearer ${await token()}`, Accept: "application/json" };
  const sales: AffiliateSale[] = [];
  for (const [start, end] of windows(from, to, 360)) {
    for (let offset = 0; ; offset += PAGE) {
      const url = `${BASE}/publisher/report/transactions?fromDate=${ymd(start)}&toDate=${ymd(end)}&limit=${PAGE}&offset=${offset}`;
      const res = await fetch(url, { headers });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.items)) {
        throw new Error(`TradeDoubler ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
      }
      for (const t of body.items as TdTx[]) {
        const status: AffiliateSale["status"] =
          t.status === "D" ? "declined" : t.status === "A" ? (t.paid ? "paid" : "approved") : "pending";
        sales.push({
          network: "tradedoubler",
          tx_id: String(t.transactionId),
          advertiser_id: String(t.programId),
          advertiser_name: t.programName ?? null,
          status,
          sale_amount: num(t.orderValue),
          commission: num(t.commission),
          currency: body.reportCurrencyCode ?? "EUR",
          click_ref: t.epi || null,
          clicked_at: isoTz(t.timeOfLastClick),
          transacted_at: isoTz(t.timeOfTransaction)!,
          validated_at: t.status === "P" ? null : isoTz(t.timeOfLastModified),
          raw: t,
        });
      }
      if (body.items.length < PAGE) break;
    }
  }
  return sales;
}
