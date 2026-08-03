import "react-native-url-polyfill/auto"; // supabase-js needs a URL/fetch polyfill on native
import { createClient } from "@supabase/supabase-js";

// Anon (user) client — RLS applies. Values come from EXPO_PUBLIC_* env (safe to ship).
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(url, anonKey);
