import { redirect } from "next/navigation";
import { getPartnerContext } from "@/lib/partner/context";
import { ProductsClient } from "./_components/ProductsClient";
import type { PartnerProduct } from "@/types/partner";

export default async function ProductsPage() {
  const ctx = await getPartnerContext();
  if (!ctx) redirect("/dashboard");

  const { supabase } = ctx;
  const partnerId = ctx.active.partnerId;

  const { data: products } = await supabase
    .from("partner_products")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  return <ProductsClient products={(products ?? []) as PartnerProduct[]} />;
}
