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

export type PartnerProductStatus = "pending" | "approved" | "rejected";

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
  min_age: number | null;
  max_age: number | null;
  gender: "male" | "female" | null;
  categories: string[];
  /** Moderation state. Partners may only create/edit 'pending' rows (RLS); an admin sets 'approved'/'rejected'. */
  status: PartnerProductStatus;
  reviewed_at: string | null;
  /** profiles.id of the admin who reviewed. */
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};
