"use client";

import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";

// Economics / config dials (ADR-0013): versioned + audited via fn_apply_config. Numbers pending
// financial modelling; the mechanism is live. (Moved out of Gamification — this is money, not XP.)
type Dial = { key: string; label: string; help: string; group: string };
const DIALS: Dial[] = [
  { key: "pricing.box_price", label: "Box price (RSD)", help: "What the customer pays per box.", group: "Pricing" },
  { key: "pricing.cogs_per_box", label: "COGS per box (RSD)", help: "Your cost per box — drives margin.", group: "Pricing" },
  { key: "pricing.currency", label: "Currency", help: 'e.g. "RSD".', group: "Pricing" },
  { key: "payout.min_threshold", label: "Payout min threshold (RSD)", help: "A referrer must accumulate this before a payout run includes them.", group: "Payouts" },
  { key: "buyer.discount_pct", label: "Buyer discount %", help: "Applies to new buyers only.", group: "Referral" },
  { key: "agent.eligibility_level", label: "Agent eligibility Level", help: "Level a Member must reach to apply.", group: "Referral" },
  { key: "agent.tier_rates", label: "Agent tier rates (JSON)", help: "Live at the next monthly snapshot.", group: "Referral" },
];
const GROUPS = ["Pricing", "Payouts", "Referral"];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("config_dials").select("key,value");
    if (error) setError(error.message);
    else {
      const map: Record<string, string> = {};
      for (const r of (data as { key: string; value: unknown }[]) ?? []) {
        map[r.key] = typeof r.value === "string" ? r.value : JSON.stringify(r.value);
      }
      setValues(map);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(dial: Dial) {
    const raw = values[dial.key] ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
      if (!isNaN(Number(raw)) && raw.trim() !== "") parsed = Number(raw);
    }
    const { error } = await supabase.rpc("fn_apply_config", { p_key: dial.key, p_value: parsed, p_reason: reasons[dial.key] ?? "" });
    if (error) setError(error.message);
    else {
      setSaved(dial.key);
      setTimeout(() => setSaved(null), 2000);
      await load();
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Pricing, payout & referral economics. Every change is versioned, grandfathered and audited." />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <div className="space-y-6">
        {GROUPS.map((g) => (
          <Card key={g}>
            <CardHeader>
              <CardTitle>{g}</CardTitle>
              {g === "Referral" && <CardDescription>Numbers pending financial modelling; the mechanism is live.</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4">
              {DIALS.filter((d) => d.group === g).map((d) => (
                <div key={d.key} className="grid grid-cols-1 gap-2 border-b border-border pb-4 last:border-0 last:pb-0 md:grid-cols-[1fr_auto]">
                  <div className="space-y-1.5">
                    <Label>{d.label}</Label>
                    <p className="text-xs text-muted-foreground">{d.help}</p>
                    <Input value={values[d.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [d.key]: e.target.value }))} />
                  </div>
                  <div className="flex items-end gap-2">
                    <Input placeholder="Reason" value={reasons[d.key] ?? ""} onChange={(e) => setReasons((r) => ({ ...r, [d.key]: e.target.value }))} />
                    <Button size="sm" disabled={!(reasons[d.key] ?? "").trim()} onClick={() => save(d)}>
                      {saved === d.key ? "Saved ✓" : "Save"}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
