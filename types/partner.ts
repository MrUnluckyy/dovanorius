export type Partner = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type PartnerUser = {
  id: string;
  partner_id: string;
  user_id: string;
  role: "owner" | "member";
  created_at: string;
};

export type PartnerInvite = {
  id: string;
  partner_id: string;
  email: string;
  token: string;
  role: "owner" | "member";
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};

export type PartnerProduct = {
  id: string;
  partner_id: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  image_url: string | null;
  product_url: string | null;
  sku: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
