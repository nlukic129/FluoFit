import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type FluofitClient = SupabaseClient<Database>;

/**
 * Anon/user client — RLS applies (this is what the apps use). The session's JWT decides
 * what rows are visible per the policies in 0011_rls_policies.sql.
 */
export function createFluofitClient(url: string, anonKey: string): FluofitClient {
  return createClient<Database>(url, anonKey);
}

/**
 * Service-role client — BYPASSES RLS. Use ONLY inside trusted server code (Edge Functions,
 * engines) that must write across Members (scan-sync, refill, commission). Never ship this
 * key to a client bundle.
 */
export function createServiceClient(url: string, serviceRoleKey: string): FluofitClient {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type { Database } from "./database.types";
