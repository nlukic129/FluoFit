import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

// Admin uses the anon client + an authenticated (Email OTP) session. Admin RPCs are
// SECURITY DEFINER but gated by is_admin() on the caller's roles — so the service-role key is
// NEVER shipped here. Values from EXPO_PUBLIC_* env.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(url, anonKey);
