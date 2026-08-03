// Dynamic config client (ADR-0013). The Admin Console tunes every gamification/referral dial
// at runtime; how a change propagates (grandfathered vs live) is enforced server-side by the
// engines. This client only READS the live dials and WRITES through the audited, admin-gated
// fn_apply_config RPC (0010) — it never touches config_dials directly.
import type { SupabaseClient } from "@supabase/supabase-js";

/** Known dial keys. Values are pending COGS → pricing (placeholders in the DB). */
export type DialKey =
  | "levels.count"
  | "xp.threshold_by_level"
  | "xp.formula" // base + streak multiplier (config-only, no live UI)
  | "agent.eligibility_level"
  | "agent.tier_rates"
  | "buyer.discount_pct";

export interface ConfigClient {
  get<T = unknown>(key: DialKey): Promise<T | undefined>;
  /** Admin-only; requires a reason (audit invariant). Delegates to fn_apply_config. */
  apply(key: DialKey, value: unknown, reason: string): Promise<void>;
}

export function createConfigClient(supabase: SupabaseClient): ConfigClient {
  return {
    async get<T = unknown>(key: DialKey): Promise<T | undefined> {
      const { data, error } = await supabase
        .from("config_dials")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return (data?.value as T) ?? undefined;
    },
    async apply(key: DialKey, value: unknown, reason: string): Promise<void> {
      const { error } = await supabase.rpc("fn_apply_config", {
        p_key: key,
        p_value: value,
        p_reason: reason,
      });
      if (error) throw error;
    },
  };
}
