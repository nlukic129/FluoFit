import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

// Agent/Affiliate portal — anon client + Email-OTP session. RLS scopes a referrer to their own
// commission rows and consent-gated coaching data (ADR-0003). No service-role key here.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(url, anonKey);
