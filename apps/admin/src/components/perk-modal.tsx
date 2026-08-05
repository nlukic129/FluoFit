"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";

export type PerkLite = {
  id: string;
  name: string;
  benefit: string | null;
  funding: string;
  cost_hint: number | null;
  is_public: boolean;
  level_id: string | null;
};
// Shared perk editor. partnerId != null → a partner-funded perk (funding fixed to "partner");
// null → a FluoFit perk (funding spend/zero). Availability = Public or Level-reward (attach later).
export function PerkModal({
  perk,
  partnerId,
  onClose,
  onSaved,
}: {
  perk: PerkLite | null;
  partnerId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const partnerFunded = partnerId != null;
  const [name, setName] = useState(perk?.name ?? "");
  const [benefit, setBenefit] = useState(perk?.benefit ?? "");
  const [funding, setFunding] = useState(perk?.funding ?? (partnerFunded ? "partner" : "spend"));
  const [cost, setCost] = useState(perk?.cost_hint != null ? String(perk.cost_hint) : "");
  const [isPublic, setIsPublic] = useState(perk?.is_public ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("fn_upsert_perk", {
      p_id: perk?.id ?? null,
      p_name: name,
      p_benefit: benefit || null,
      p_funding: partnerFunded ? "partner" : funding,
      p_cost_hint: cost === "" ? null : Number(cost),
      p_partner_id: partnerId,
      p_is_public: partnerFunded ? isPublic : false,
      p_reason: perk ? "Edited perk" : "Added perk",
    });
    setBusy(false);
    if (error) setErr(error.message);
    else onSaved();
  }

  const canSave = name.trim();

  return (
    <Modal open onClose={onClose} title={perk ? "Edit perk" : "Add perk"}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Founder AMA" />
        </div>
        <div className="space-y-1.5">
          <Label>Benefit</Label>
          <Input value={benefit} onChange={(e) => setBenefit(e.target.value)} placeholder="10% off / Free shipping" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {partnerFunded ? (
          <div className="space-y-1.5">
            <Label>Funding</Label>
            <Input value="partner" disabled />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Funding</Label>
            <Select value={funding} onChange={(e) => setFunding(e.target.value)}>
              <option value="spend">spend (FluoFit pays)</option>
              <option value="zero">zero (no cost)</option>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Cost hint (RSD, optional)</Label>
          <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
      </div>

      {partnerFunded ? (
        <div className="space-y-2">
          <Label>Availability</Label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={isPublic} onChange={() => setIsPublic(true)} style={{ accentColor: "var(--primary)" }} />
            Public — available to everyone (not a level reward)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={!isPublic} onChange={() => setIsPublic(false)} style={{ accentColor: "var(--primary)" }} />
            Level reward — attach it to a Level in Gamification
          </label>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Availability</Label>
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Level reward — FluoFit perks are always level rewards. Attach it to a Level in Gamification.
          </p>
        </div>
      )}

      {err && <p className="text-sm text-destructive">⚠️ {err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!canSave || busy} onClick={save}>
          {busy ? "Saving…" : "Save perk"}
        </Button>
      </div>
    </Modal>
  );
}
