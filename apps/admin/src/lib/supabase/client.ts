import { createClient } from "@supabase/supabase-js";

// Browser client — anon key + the admin's Email-OTP session. Every admin RPC is
// SECURITY DEFINER and gated by is_admin() on the caller's roles; the service-role key is
// never shipped to this bundle. Fallbacks keep the production build from throwing when env is
// absent at build time; real NEXT_PUBLIC_* values are supplied via apps/admin/.env.local.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "anon-placeholder";

export const supabase = createClient(url, anonKey);
