import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // or SUPABASE_URL, pick ONE
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) throw new Error("supabaseUrl is not set");
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
