"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
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
import { rsd } from "@/lib/overview";
import { supabase } from "@/lib/supabase/client";

type Level = { id: string; ordinal: number; threshold_xp: number; name: string; icon: string | null };

const fundingTone = (f: string) => (f === "partner" ? "info" : f === "spend" ? "warning" : "neutral");

export default function GamificationPage() {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <PageHeader
        title="Gamification"
        subtitle="Levels, XP and perks — with live engagement insight. Changes are audited and grandfathered."
      />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}
      <div className="space-y-6">
        <InsightSection onError={setError} />
        <LevelsSection onError={setError} />
        <LevelRewardsSection onError={setError} />
      </div>
    </>
  );
}

function LevelsSection({ onError }: { onError: (m: string) => void }) {
  const [levels, setLevels] = useState<Level[]>([]);
  const [editing, setEditing] = useState<Level | "new" | null>(null);
  const [delTarget, setDelTarget] = useState<Level | null>(null);

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
                    <Button size="sm" variant="destructive" onClick={() => setDelTarget(l)}>
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
      {delTarget && (
        <ReasonModal
          title={`Delete Level "${delTarget.name}"`}
          confirmLabel="Delete level"
          destructive
          run={async (reason) => {
            const { error } = await supabase.rpc("fn_delete_level", { p_id: delTarget.id, p_reason: reason });
            return { error };
          }}
          onClose={() => setDelTarget(null)}
          onDone={load}
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
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("fn_upsert_level", {
      p_id: level?.id ?? null,
      p_ordinal: Number(ordinal),
      p_threshold_xp: Number(threshold),
      p_name: name,
      p_icon: null,
      p_reason: level ? "Edited level" : "Added level",
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
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!name || !ordinal || !threshold || busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

type RewardPerk = {
  id: string; name: string; benefit: string | null; funding: string; source: string;
  level_id: string | null; level_ordinal: number | null; level_name: string | null;
};

function LevelRewardsSection({ onError }: { onError: (m: string) => void }) {
  const [levels, setLevels] = useState<Level[]>([]);
  const [perks, setPerks] = useState<RewardPerk[]>([]);
  const [attachLevel, setAttachLevel] = useState<Level | null>(null);
  const [unattachTarget, setUnattachTarget] = useState<RewardPerk | null>(null);

  const load = useCallback(async () => {
    const [lv, pk] = await Promise.all([
      supabase.from("levels").select("id,ordinal,threshold_xp,name,icon").order("ordinal"),
      supabase.rpc("fn_admin_list_reward_perks"),
    ]);
    if (lv.data) setLevels(lv.data as Level[]);
    if (pk.error) onError(pk.error.message);
    else setPerks((pk.data as RewardPerk[]) ?? []);
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const unattached = perks.filter((p) => !p.level_id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Level rewards</CardTitle>
        <CardDescription>Attach non-public perks (FluoFit + partner) to a Level. Create perks in the Perks tab.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {levels.map((l) => {
          const attached = perks.filter((p) => p.level_id === l.id);
          return (
            <div key={l.id} className="flex items-start gap-3">
              <span className="w-24 shrink-0 pt-1 text-sm font-medium">{l.ordinal}. {l.name}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {attached.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                    {p.name}
                    {p.benefit ? ` · ${p.benefit}` : ""}
                    <span className="text-muted-foreground">· {p.source}</span>
                    <button className="ml-0.5 text-muted-foreground hover:text-destructive" onClick={() => setUnattachTarget(p)} title="Unattach">✕</button>
                  </span>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={unattached.length === 0}
                  title={unattached.length === 0 ? "No unattached perks left — create one in the Perks tab first" : undefined}
                  onClick={() => setAttachLevel(l)}
                >
                  <Plus /> Add reward
                </Button>
              </div>
            </div>
          );
        })}
        {unattached.length > 0 ? (
          <p className="pt-1 text-xs text-muted-foreground">
            Unattached rewards: {unattached.map((p) => p.name).join(", ")}
          </p>
        ) : (
          <p className="pt-1 text-xs text-muted-foreground">
            Every non-public perk is already attached. To add another reward, create a non-public perk in the{" "}
            <Link href="/perks" className="font-medium text-primary hover:underline">Perks tab</Link> first.
          </p>
        )}
      </CardContent>

      {attachLevel && (
        <AttachRewardModal level={attachLevel} options={unattached} onClose={() => setAttachLevel(null)} onDone={load} />
      )}
      {unattachTarget && (
        <ConfirmModal
          title={`Unattach "${unattachTarget.name}" from ${unattachTarget.level_name}`}
          body="It goes back to the unattached pool — you can re-attach it any time."
          confirmLabel="Unattach"
          destructive
          run={async () => {
            const { error } = await supabase.rpc("fn_admin_attach_perk_level", { p_perk: unattachTarget.id, p_level: null, p_reason: "Unattached perk from level" });
            return { error };
          }}
          onClose={() => setUnattachTarget(null)}
          onDone={load}
        />
      )}
    </Card>
  );
}

function AttachRewardModal({ level, options, onClose, onDone }: { level: Level; options: RewardPerk[]; onClose: () => void; onDone: () => void }) {
  const [perk, setPerk] = useState(options[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("fn_admin_attach_perk_level", { p_perk: perk, p_level: level.id, p_reason: "Attached perk to level" });
    setBusy(false);
    if (error) setErr(error.message);
    else { onDone(); onClose(); }
  }
  return (
    <Modal open onClose={onClose} title={`Add reward to ${level.name}`}>
      <div className="space-y-1.5">
        <Label>Perk</Label>
        <Select value={perk} onChange={(e) => setPerk(e.target.value)}>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.source}
            </option>
          ))}
        </Select>
      </div>
      {err && <p className="text-sm text-destructive">⚠️ {err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!perk || busy} onClick={go}>{busy ? "Attaching…" : "Attach"}</Button>
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

type Insight = {
  total_members: number;
  xp_per_scan: number | string;
  levels: { ordinal: number; name: string; threshold_xp: number; members: number; near_up: number }[];
  perks: { id: string; name: string; funding: string; cost_hint: number | null; is_public: boolean; source: string; level_ordinal: number | null; reach: number; est_cost: number }[];
};

function InsightSection({ onError }: { onError: (m: string) => void }) {
  const [d, setD] = useState<Insight | null>(null);
  const [xp, setXp] = useState("");
  const [xpReason, setXpReason] = useState("");
  const [xpBusy, setXpBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("fn_admin_gamification_insight");
    if (error) onError(error.message);
    else {
      const i = data as Insight;
      setD(i);
      setXp(String(i.xp_per_scan));
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveXp() {
    setXpBusy(true);
    const { error } = await supabase.rpc("fn_apply_config", {
      p_key: "gamification.xp_per_scan",
      p_value: Number(xp),
      p_reason: xpReason,
    });
    setXpBusy(false);
    if (error) onError(error.message);
    else {
      setSaved(true);
      setXpReason("");
      setTimeout(() => setSaved(false), 2000);
      await load();
    }
  }

  if (!d) return null;
  const maxM = Math.max(1, ...d.levels.map((l) => l.members));
  const spendCost = d.perks.filter((p) => p.funding === "spend").reduce((s, p) => s + Number(p.est_cost), 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Level distribution</CardTitle>
          <CardDescription>{d.total_members} members · amber = near the next level</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {d.levels.map((l) => (
            <div key={l.ordinal} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0 truncate text-muted-foreground">
                {l.ordinal}. {l.name}
              </span>
              <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted">
                <div className="h-full bg-primary" style={{ width: `${(l.members / maxM) * 100}%` }} />
              </div>
              <span className="tabular w-8 text-right font-medium">{l.members}</span>
              <span className="tabular w-16 text-right text-xs text-amber-600">{l.near_up > 0 ? `+${l.near_up} near` : ""}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>XP per scan</CardTitle>
            <CardDescription>How much XP an earning scan carries. Applies to future scans; levels never drop.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label>XP / scan</Label>
                <Input className="w-24" type="number" value={xp} onChange={(e) => setXp(e.target.value)} />
              </div>
              <Input placeholder="Reason" value={xpReason} onChange={(e) => setXpReason(e.target.value)} />
              <Button size="sm" disabled={!xpReason.trim() || xpBusy} onClick={saveXp}>
                {saved ? "Saved ✓" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perk reach</CardTitle>
            <CardDescription>
              Spend perks cost you (≈ reach × hint); partner/zero don&apos;t. Est. spend exposure:{" "}
              <span className="font-medium text-foreground">{rsd(spendCost)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perk</TableHead>
                  <TableHead>Funding</TableHead>
                  <TableHead className="text-right">Reach</TableHead>
                  <TableHead className="text-right">Est. cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.perks.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={4}>No perks.</TableCell>
                  </TableRow>
                ) : (
                  d.perks.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.name}
                        <span className="ml-1 text-xs text-muted-foreground">
                          · {p.source}
                          {p.is_public ? " · public" : p.level_ordinal == null ? " · unattached" : ` · L${p.level_ordinal}`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge tone={fundingTone(p.funding)}>{p.funding}</Badge>
                      </TableCell>
                      <TableCell className="tabular text-right">{p.reach}</TableCell>
                      <TableCell className="tabular text-right">{p.funding === "spend" ? rsd(p.est_cost) : "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Small audited reason prompt (replaces window.prompt for deletes / unmaps).
function ReasonModal({
  title,
  confirmLabel,
  destructive,
  run,
  onClose,
  onDone,
}: {
  title: string;
  confirmLabel: string;
  destructive?: boolean;
  run: (reason: string) => Promise<{ error: { message: string } | null }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setErr(null);
    const { error } = await run(reason);
    setBusy(false);
    if (error) setErr(error.message);
    else {
      onDone();
      onClose();
    }
  }
  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-1.5">
        <Label>Reason (required — audited)</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {err && <p className="text-sm text-destructive">⚠️ {err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant={destructive ? "destructive" : "default"} disabled={!reason.trim() || busy} onClick={go}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  destructive,
  run,
  onClose,
  onDone,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  destructive?: boolean;
  run: () => Promise<{ error: { message: string } | null }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setErr(null);
    const { error } = await run();
    setBusy(false);
    if (error) setErr(error.message);
    else {
      onDone();
      onClose();
    }
  }
  return (
    <Modal open onClose={onClose} title={title}>
      {body && <p className="text-sm text-muted-foreground">{body}</p>}
      {err && <p className="text-sm text-destructive">⚠️ {err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant={destructive ? "destructive" : "default"} disabled={busy} onClick={go}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
