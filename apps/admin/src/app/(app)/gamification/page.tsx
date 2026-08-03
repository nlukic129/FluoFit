"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";

type Level = { id: string; ordinal: number; threshold_xp: number; name: string; icon: string | null };

export default function GamificationPage() {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <PageHeader
        title="Gamification"
        subtitle="Levels, perks, and referral dials. Changes are audited and grandfathered per ADR-0013."
      />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}
      <div className="space-y-6">
        <LevelsSection onError={setError} />
        <PerksSection onError={setError} />
        <DialsSection onError={setError} />
      </div>
    </>
  );
}

function LevelsSection({ onError }: { onError: (m: string) => void }) {
  const [levels, setLevels] = useState<Level[]>([]);
  const [editing, setEditing] = useState<Level | "new" | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("levels")
      .select("id,ordinal,threshold_xp,name,icon")
      .order("ordinal");
    if (error) onError(error.message);
    else setLevels((data as Level[]) ?? []);
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function del(l: Level) {
    const reason = window.prompt(`Delete Level "${l.name}"? Reason:`);
    if (!reason) return;
    const { error } = await supabase.rpc("fn_delete_level", { p_id: l.id, p_reason: reason });
    if (error) onError(error.message);
    else await load();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Levels</CardTitle>
          <CardDescription>Thresholds never demote existing holders.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus /> Add level
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Threshold XP</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {levels.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={4}>
                  No levels yet.
                </TableCell>
              </TableRow>
            ) : (
              levels.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="tabular">{l.ordinal}</TableCell>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="tabular">{l.threshold_xp}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditing(l)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => del(l)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
      {editing && (
        <LevelModal
          level={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
          onError={onError}
        />
      )}
    </Card>
  );
}

function LevelModal({
  level,
  onClose,
  onSaved,
  onError,
}: {
  level: Level | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [ordinal, setOrdinal] = useState(String(level?.ordinal ?? ""));
  const [name, setName] = useState(level?.name ?? "");
  const [threshold, setThreshold] = useState(String(level?.threshold_xp ?? ""));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("fn_upsert_level", {
      p_id: level?.id ?? null,
      p_ordinal: Number(ordinal),
      p_threshold_xp: Number(threshold),
      p_name: name,
      p_icon: null,
      p_reason: reason,
    });
    setBusy(false);
    if (error) onError(error.message);
    else onSaved();
  }

  return (
    <Modal open onClose={onClose} title={level ? "Edit level" : "Add level"}>
      <Row label="Ordinal">
        <Input type="number" value={ordinal} onChange={(e) => setOrdinal(e.target.value)} />
      </Row>
      <Row label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Row>
      <Row label="Threshold XP">
        <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
      </Row>
      <Row label="Reason">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="required" />
      </Row>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!name || !ordinal || !threshold || !reason.trim() || busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

type Dial = { key: string; label: string; help: string };
const DIALS: Dial[] = [
  { key: "agent.eligibility_level", label: "Agent eligibility Level", help: "Level a Member must reach to apply." },
  { key: "buyer.discount_pct", label: "Buyer discount %", help: "Applies to new buyers only (ADR-0004)." },
  { key: "agent.tier_rates", label: "Agent tier rates (JSON)", help: "Live at the next monthly snapshot." },
];

function DialsSection({ onError }: { onError: (m: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("config_dials").select("key,value");
    if (error) onError(error.message);
    else {
      const map: Record<string, string> = {};
      for (const r of (data as { key: string; value: unknown }[]) ?? []) {
        map[r.key] = typeof r.value === "string" ? r.value : JSON.stringify(r.value);
      }
      setValues(map);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(dial: Dial) {
    const raw = values[dial.key] ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw; // allow plain strings/numbers typed without quotes
      if (!isNaN(Number(raw)) && raw.trim() !== "") parsed = Number(raw);
    }
    const { error } = await supabase.rpc("fn_apply_config", {
      p_key: dial.key,
      p_value: parsed,
      p_reason: reasons[dial.key] ?? "",
    });
    if (error) onError(error.message);
    else {
      setSaved(dial.key);
      setTimeout(() => setSaved(null), 2000);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Referral & config dials</CardTitle>
        <CardDescription>Numbers are pending COGS/pricing; the mechanism is live.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {DIALS.map((d) => (
          <div key={d.key} className="grid grid-cols-1 gap-2 border-b border-border pb-4 last:border-0 last:pb-0 md:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label>{d.label}</Label>
              <p className="text-xs text-muted-foreground">{d.help}</p>
              <Input
                value={values[d.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [d.key]: e.target.value }))}
              />
            </div>
            <div className="flex items-end gap-2">
              <Input
                placeholder="Reason"
                value={reasons[d.key] ?? ""}
                onChange={(e) => setReasons((r) => ({ ...r, [d.key]: e.target.value }))}
              />
              <Button
                size="sm"
                disabled={!(reasons[d.key] ?? "").trim()}
                onClick={() => save(d)}
              >
                {saved === d.key ? "Saved ✓" : "Save"}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

type Perk = { id: string; name: string; funding: string; cost_hint: number | null };
type Mapping = { level_id: string; perk_id: string };
const fundingTone = (f: string) => (f === "partner" ? "info" : f === "spend" ? "warning" : "neutral");

function PerksSection({ onError }: { onError: (m: string) => void }) {
  const [perks, setPerks] = useState<Perk[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [editing, setEditing] = useState<Perk | "new" | null>(null);
  const [mapPerk, setMapPerk] = useState("");
  const [mapLevel, setMapLevel] = useState("");
  const [mapReason, setMapReason] = useState("");

  const load = useCallback(async () => {
    const [pk, lv, mp] = await Promise.all([
      supabase.from("perks").select("id,name,funding,cost_hint").order("name"),
      supabase.from("levels").select("id,ordinal,threshold_xp,name,icon").order("ordinal"),
      supabase.from("level_perks").select("level_id,perk_id"),
    ]);
    if (pk.error) onError(pk.error.message);
    else setPerks((pk.data as Perk[]) ?? []);
    if (lv.data) setLevels(lv.data as Level[]);
    if (mp.data) setMappings(mp.data as Mapping[]);
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function map() {
    const { error } = await supabase.rpc("fn_map_perk_level", {
      p_level: mapLevel,
      p_perk: mapPerk,
      p_reason: mapReason,
    });
    if (error) onError(error.message);
    else {
      setMapReason("");
      await load();
    }
  }

  async function unmap(m: Mapping) {
    const reason = window.prompt("Unmap this perk? Reason:");
    if (!reason) return;
    const { error } = await supabase.rpc("fn_unmap_perk_level", {
      p_level: m.level_id,
      p_perk: m.perk_id,
      p_reason: reason,
    });
    if (error) onError(error.message);
    else await load();
  }

  const perkName = (id: string) => perks.find((p) => p.id === id)?.name ?? id;
  const levelName = (id: string) => levels.find((l) => l.id === id)?.name ?? id;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Perks</CardTitle>
          <CardDescription>Partner-funded run live; spend/zero are grandfathered at crossing.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus /> Add perk
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Funding</TableHead>
              <TableHead>Cost hint</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {perks.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={4}>
                  No perks yet.
                </TableCell>
              </TableRow>
            ) : (
              perks.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <Badge tone={fundingTone(p.funding)}>{p.funding}</Badge>
                  </TableCell>
                  <TableCell className="tabular">{p.cost_hint != null ? `€${p.cost_hint}` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="space-y-2">
          <p className="text-sm font-medium">Map perk → Level</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
            <Select value={mapPerk} onChange={(e) => setMapPerk(e.target.value)}>
              <option value="">Perk…</option>
              {perks.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select value={mapLevel} onChange={(e) => setMapLevel(e.target.value)}>
              <option value="">Level…</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Input placeholder="Reason" value={mapReason} onChange={(e) => setMapReason(e.target.value)} />
            <Button disabled={!mapPerk || !mapLevel || !mapReason.trim()} onClick={map}>
              Map
            </Button>
          </div>

          {mappings.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {mappings.map((m) => (
                <button
                  key={`${m.level_id}-${m.perk_id}`}
                  onClick={() => unmap(m)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
                  title="Unmap"
                >
                  {perkName(m.perk_id)} → {levelName(m.level_id)} ✕
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      {editing && (
        <PerkModal
          perk={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
          onError={onError}
        />
      )}
    </Card>
  );
}

function PerkModal({
  perk,
  onClose,
  onSaved,
  onError,
}: {
  perk: Perk | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(perk?.name ?? "");
  const [funding, setFunding] = useState(perk?.funding ?? "spend");
  const [cost, setCost] = useState(perk?.cost_hint != null ? String(perk.cost_hint) : "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("fn_upsert_perk", {
      p_id: perk?.id ?? null,
      p_name: name,
      p_funding: funding,
      p_cost_hint: cost === "" ? null : Number(cost),
      p_reason: reason,
    });
    setBusy(false);
    if (error) onError(error.message);
    else onSaved();
  }

  return (
    <Modal open onClose={onClose} title={perk ? "Edit perk" : "Add perk"}>
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Funding</Label>
        <Select value={funding} onChange={(e) => setFunding(e.target.value)}>
          <option value="partner">partner</option>
          <option value="spend">spend</option>
          <option value="zero">zero</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Cost hint (€, optional)</Label>
        <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Reason</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="required" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!name || !reason.trim() || busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
