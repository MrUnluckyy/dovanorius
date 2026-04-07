import { createClient } from "@/utils/supabase/server";
import { ProductsClient } from "./_components/ProductsClient";
import type { PartnerProduct } from "@/types/partner";

export default async function ProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: partnerUser } = await supabase
    .from("partner_users")
    .select("partner_id")
    .eq("user_id", user!.id)
    .single();

  const partnerId = partnerUser!.partner_id;

  const { data: products } = await supabase
    .from("partner_products")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  return (
    <ProductsClient
      products={(products ?? []) as PartnerProduct[]}
      partnerId={partnerId}
    />
  );
}
