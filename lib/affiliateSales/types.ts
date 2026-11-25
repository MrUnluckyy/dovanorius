/** One sale from any affiliate network, in the shape of affiliate_transactions. */
export type AffiliateSale = {
  network: "awin" | "cj" | "tradedoubler";
  tx_id: string;
  advertiser_id: string | null;
  advertiser_name: string | null;
  status: "pending" | "approved" | "declined" | "paid";
  sale_amount: number | null;
  commission: number | null;
  currency: string | null;
  /** The sub id /out sent with the click (= affiliate_clicks.sub_id). */
  click_ref: string | null;
  clicked_at: string | null;
  transacted_at: string;
  validated_at: string | null;
  raw: unknown;
};

/** Split [from, to) into windows no longer than `maxDays` (APIs cap ranges at ~31 days). */
export function windows(from: Date, to: Date, maxDays = 30): [Date, Date][] {
  const out: [Date, Date][] = [];
  for (let start = from; start < to; ) {
    const end = new Date(Math.min(to.getTime(), start.getTime() + maxDays * 864e5));
    out.push([start, end]);
    start = end;
  }
  return out;
}

export const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};
