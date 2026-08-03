// Shared domain types + runtime schemas. These mirror the Postgres enums in
// supabase/migrations so the app and the DB speak the same language (CONTEXT.md glossary).
import { z } from "zod";

export const AppRole = z.enum(["member", "agent", "affiliate", "admin"]);
export type AppRole = z.infer<typeof AppRole>;

export const BoxStatus = z.enum(["unbound", "activated", "void"]); // Manufactured/Unbound → Activated | Void
export type BoxStatus = z.infer<typeof BoxStatus>;

export const SubStatus = z.enum(["active", "paused", "lapsed", "cancelled"]);
export type SubStatus = z.infer<typeof SubStatus>;

export const RefillMode = z.enum(["smart", "manual"]);
export type RefillMode = z.infer<typeof RefillMode>;

export const SmartSubstate = z.enum(["pending", "active"]);
export type SmartSubstate = z.infer<typeof SmartSubstate>;

export const CommissionState = z.enum([
  "accrued",
  "cleared",
  "payable",
  "paid",
  "clawed_back",
]);
export type CommissionState = z.infer<typeof CommissionState>;

export const PerkFunding = z.enum(["partner", "spend", "zero"]);
export type PerkFunding = z.infer<typeof PerkFunding>;

// A Manual Subscription's cadence is bounded 28–60 days (ADR-0011): 28 = daily-consumer
// floor, 60 = lightest honest consumer / absolute cap.
export const CadenceDays = z.number().int().min(28).max(60);

// Guard: a Smart Subscription carries a substate and NO cadence; a Manual one is the inverse.
export const SubscriptionShape = z
  .object({
    refillMode: RefillMode,
    smartSubstate: SmartSubstate.nullable(),
    cadenceDays: CadenceDays.nullable(),
  })
  .refine(
    (s) =>
      s.refillMode === "smart"
        ? s.smartSubstate !== null && s.cadenceDays === null
        : s.smartSubstate === null && s.cadenceDays !== null,
    { message: "smart ⇒ substate & no cadence; manual ⇒ cadence & no substate" },
  );
