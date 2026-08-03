"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
