/**
 * CJ Commission Detail API (GraphQL, commissions.api.cj.com). At most 31 days
 * of posting date per call. Needs CJ_ACCESS_TOKEN and CJ_COMPANY_ID.
 * Amounts are taken in the publisher's own currency (…PubCurrency), not USD.
 */
import { num, windows, type AffiliateSale } from "./types";

type CjRecord = {
  commissionId: string;
  advertiserId: string;
  advertiserName: string;
  actionStatus: string; // new | extended | locked | closed
  validationStatus: string | null; // ACCEPTED | DECLINED | …
  saleAmountPubCurrency: string | number | null;
  pubCommissionAmountPubCurrency: string | number | null;
  shopperId: string | null; // the sid we send = our click sub id
  clickDate: string | null;
  eventDate: string;
  postingDate: string;
  lockingDate: string | null;
};

const QUERY = (company: string, since: string, before: string) => `{
  publisherCommissions(forPublishers: ["${company}"], sincePostingDate: "${since}", beforePostingDate: "${before}") {
    count payloadComplete
    records {
      commissionId advertiserId advertiserName actionStatus validationStatus
      saleAmountPubCurrency pubCommissionAmountPubCurrency shopperId
      clickDate eventDate postingDate lockingDate
    }
  }
}`;

export async function fetchCjSales(from: Date, to: Date, currency = "EUR"): Promise<AffiliateSale[]> {
  const token = process.env.CJ_ACCESS_TOKEN;
  const company = process.env.CJ_COMPANY_ID;
  if (!token || !company) throw new Error("CJ_ACCESS_TOKEN / CJ_COMPANY_ID not set");

  const sales: AffiliateSale[] = [];
  for (const [start, end] of windows(from, to)) {
    const res = await fetch("https://commissions.api.cj.com/query", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY(company, start.toISOString(), end.toISOString()) }),
    });
    const body = await res.json().catch(() => null);
    const data = body?.data?.publisherCommissions;
    if (!res.ok || !data) throw new Error(`CJ ${res.status}: ${JSON.stringify(body?.errors ?? body).slice(0, 200)}`);
    if (!data.payloadComplete) throw new Error("CJ returned a partial payload; narrow the window");
    for (const r of data.records as CjRecord[]) {
      const status: AffiliateSale["status"] =
        /declin|reject|cancel/i.test(r.validationStatus ?? "") ? "declined"
        : r.actionStatus === "closed" ? "paid"
        : r.actionStatus === "locked" ? "approved"
        : "pending";
      sales.push({
        network: "cj",
        tx_id: r.commissionId,
        advertiser_id: r.advertiserId,
        advertiser_name: r.advertiserName,
        status,
        sale_amount: num(r.saleAmountPubCurrency),
        commission: num(r.pubCommissionAmountPubCurrency),
        currency,
        click_ref: r.shopperId || null,
        clicked_at: r.clickDate,
        transacted_at: r.eventDate,
        validated_at: r.lockingDate,
        raw: r,
      });
    }
  }
  return sales;
}
