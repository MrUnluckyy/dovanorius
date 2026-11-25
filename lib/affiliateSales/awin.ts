/**
 * Awin publisher transactions API.
 * GET /publishers/{id}/transactions/ — at most 31 days per call, ~20 calls a
 * minute. Needs AWIN_API_KEY (the user's API token, Awin → profile → API
 * credentials; NOT the datafeed key) and AWIN_PUBLISHER_ID.
 */
import { num, windows, type AffiliateSale } from "./types";

type AwinTx = {
  id: number;
  advertiserId: number;
  commissionStatus: "pending" | "approved" | "declined" | "deleted";
  paidToPublisher?: boolean;
  saleAmount?: { amount: number; currency: string };
  commissionAmount?: { amount: number; currency: string };
  clickRefs?: Record<string, string | null> | null;
  clickDate?: string;
  transactionDate: string;
  validationDate?: string | null;
};

const iso = (d: Date) => d.toISOString().slice(0, 19);

export async function fetchAwinSales(
  from: Date,
  to: Date,
  advertiserNames: Map<string, string>
): Promise<AffiliateSale[]> {
  const key = process.env.AWIN_API_KEY;
  const publisher = process.env.AWIN_PUBLISHER_ID;
  if (!key || !publisher) throw new Error("AWIN_API_KEY / AWIN_PUBLISHER_ID not set");

  const sales: AffiliateSale[] = [];
  for (const [start, end] of windows(from, to)) {
    const url =
      `https://api.awin.com/publishers/${publisher}/transactions/` +
      `?startDate=${iso(start)}&endDate=${iso(end)}&timezone=UTC&dateType=transaction`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`Awin ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const rows = (await res.json()) as AwinTx[];
    for (const t of rows) {
      // "deleted" = removed by the advertiser: it will never pay, so declined.
      const status: AffiliateSale["status"] =
        t.commissionStatus === "approved" ? (t.paidToPublisher ? "paid" : "approved")
        : t.commissionStatus === "pending" ? "pending"
        : "declined";
      sales.push({
        network: "awin",
        tx_id: String(t.id),
        advertiser_id: String(t.advertiserId),
        advertiser_name: advertiserNames.get(String(t.advertiserId)) ?? null,
        status,
        sale_amount: num(t.saleAmount?.amount),
        commission: num(t.commissionAmount?.amount),
        currency: t.commissionAmount?.currency ?? t.saleAmount?.currency ?? null,
        click_ref: t.clickRefs?.clickRef ?? null,
        clicked_at: t.clickDate ?? null,
        transacted_at: t.transactionDate,
        validated_at: t.validationDate ?? null,
        raw: t,
      });
    }
  }
  return sales;
}
