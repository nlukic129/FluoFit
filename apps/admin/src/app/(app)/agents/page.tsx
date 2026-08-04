"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Pager } from "@/components/pager";
import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rsd } from "@/lib/overview";
import { supabase } from "@/lib/supabase/client";

type Agent = {
  profile_id: string;
  email: string | null;
  display_name: string | null;
  status: string;
  ref_code: string;
  current_tier: number | null;
  active_subs: number;
  paid_earnings: number;
  pending_earnings: number;
  total_count: number;
};

const AGENTS_PAGE = 20;
const APPLICANTS_PAGE = 15;
type Wave = {
  id: string;
  name: string;
  soft_cap: number | null;
  city_focus: string | null;
  niche_note: string | null;
  status: string;
  applied_n: number;
  approved_n: number;
  waitlisted_n: number;
};
type Applicant = {
  application_id: string;
  profile_id: string;
  email: string | null;
  display_name: string | null;
  status: string;
  current_level: number;
  current_streak: number;
  longest_streak: number;
  adherence: number;
  city: string | null;
  joined: string;
};

// Reusable audited action (optional reason + extra fields).
type ActionSpec = {
  title: string;
  desc?: string;
  confirmLabel: string;
  destructive?: boolean;
  extra?: { key: string; label: string; placeholder?: string; type?: string; value?: string }[];
  run: (v: { reason: string; extra: Record<string, string> }) => Promise<{ error: { message: string } | null }>;
};

const statusTone = (s: string) => (s === "active" ? "success" : s === "paused" ? "warning" : "neutral");
const appTone = (s: string) => (s === "approved" ? "success" : s === "waitlisted" ? "warning" : "neutral");

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentPage, setAgentPage] = useState(0);
  const [agentTotal, setAgentTotal] = useState(0);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [selected, setSelected] = useState<Wave | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [appPage, setAppPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [openWave, setOpenWave] = useState(false);
  const [action, setAction] = useState<ActionSpec | null>(null);

  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(fn, args);
    return { error };
  };

  const loadAgents = useCallback(async () => {
    const { data, error } = await supabase.rpc("fn_admin_list_referrers", {
      p_type: "agent",
      p_limit: AGENTS_PAGE,
      p_offset: agentPage * AGENTS_PAGE,
    });
    if (error) setError(error.message);
    else {
      const rows = (data as Agent[]) ?? [];
      setAgents(rows);
      setAgentTotal(rows.length ? Number(rows[0]!.total_count) : 0);
    }
  }, [agentPage]);

  const loadWaves = useCallback(async () => {
    const { data, error } = await supabase.rpc("fn_admin_list_waves");
    if (error) setError(error.message);
    else setWaves((data as Wave[]) ?? []);
  }, []);

  useEffect(() => {
    void loadAgents();
    void loadWaves();
  }, [loadAgents, loadWaves]);

  const viewApplicants = useCallback(async (wave: Wave) => {
    setSelected(wave);
    setAppPage(0);
    const { data, error } = await supabase.rpc("fn_admin_wave_applicants", { p_wave: wave.id });
    if (error) setError(error.message);
    else setApplicants((data as Applicant[]) ?? []);
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadAgents(), loadWaves(), selected ? viewApplicants(selected) : Promise.resolve()]);
  }, [loadAgents, loadWaves, selected, viewApplicants]);

  return (
    <>
      <PageHeader
        title="Agents"
        subtitle="Manage active agents and run capped intake waves."
        actions={
          <Button onClick={() => setOpenWave(true)}>
            <Plus /> Open wave
          </Button>
        }
      />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      {/* Roster */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Active agents ({agents.length})</CardTitle>
          <CardDescription>Earnings by commission state — release/clawback lives on Fraud.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Ref code</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Active subs</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={8}>
                    No agents yet — approve applicants below.
                  </TableCell>
                </TableRow>
              ) : (
                agents.map((a) => (
                  <TableRow key={a.profile_id}>
                    <TableCell>
                      <Link href={`/agents/${a.profile_id}`} className="font-medium hover:underline">
                        {a.display_name ?? a.email ?? "—"}
                      </Link>
                      <div className="text-xs text-muted-foreground">{a.email}</div>
                    </TableCell>
                    <TableCell className="tabular">{a.ref_code}</TableCell>
                    <TableCell className="tabular">{a.current_tier ?? "—"}</TableCell>
                    <TableCell className="tabular">{a.active_subs}</TableCell>
                    <TableCell className="tabular">{rsd(a.pending_earnings)}</TableCell>
                    <TableCell className="tabular">{rsd(a.paid_earnings)}</TableCell>
                    <TableCell>
                      <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                    </TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap text-right">
                      {a.status !== "offboarded" && (
                        <>
                          <button className="text-xs font-medium text-primary hover:underline" onClick={() => setAction(tierSpec(rpc, a, reloadAll))}>
                            Tier
                          </button>
                          <button className="text-xs font-medium text-primary hover:underline" onClick={() => setAction(statusSpec(rpc, a, a.status === "paused" ? "active" : "paused", reloadAll))}>
                            {a.status === "paused" ? "Resume" : "Pause"}
                          </button>
                          <button className="text-xs font-medium text-destructive hover:underline" onClick={() => setAction(statusSpec(rpc, a, "offboarded", reloadAll))}>
                            Offboard
                          </button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pager page={agentPage} pageSize={AGENTS_PAGE} total={agentTotal} onPage={setAgentPage} unit="agents" />
        </CardContent>
      </Card>

      {/* Intake */}
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Intake waves</h2>
      <Card className="mb-6">
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>City focus</TableHead>
                <TableHead>Approved / cap</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waves.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={6}>
                    No waves yet.
                  </TableCell>
                </TableRow>
              ) : (
                waves.map((w) => {
                  const over = w.soft_cap != null && w.approved_n >= w.soft_cap;
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell>{w.city_focus ?? "—"}</TableCell>
                      <TableCell className={over ? "tabular font-medium text-amber-600" : "tabular"}>
                        {w.approved_n} / {w.soft_cap ?? "∞"}
                      </TableCell>
                      <TableCell className="tabular">
                        {w.applied_n}
                        {w.waitlisted_n > 0 && (
                          <span className="text-xs font-normal text-muted-foreground"> · {w.waitlisted_n} waitlisted</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge tone={w.status === "open" ? "success" : "neutral"}>{w.status}</Badge>
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => viewApplicants(w)}>
                          Applicants ({w.applied_n + w.waitlisted_n})
                        </Button>
                        {w.status === "open" && (
                          <Button size="sm" variant="outline" onClick={() => setAction(closeSpec(rpc, w, reloadAll))}>
                            Close
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>Applicants — {selected.name}</CardTitle>
            <CardDescription>
              Ranked by Level then streak (proof they live the product){selected.niche_note ? ` · ${selected.niche_note}` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>
                    Streak <span className="font-normal text-muted-foreground">(current / longest)</span>
                  </TableHead>
                  <TableHead>Adherence</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applicants.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={8}>
                      No applicants.
                    </TableCell>
                  </TableRow>
                ) : (
                  applicants.slice(appPage * APPLICANTS_PAGE, (appPage + 1) * APPLICANTS_PAGE).map((a) => (
                    <TableRow key={a.application_id}>
                      <TableCell>
                        <Link href={`/members/${a.profile_id}`} className="font-medium hover:underline">
                          {a.display_name ?? a.email ?? "—"}
                        </Link>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </TableCell>
                      <TableCell className="tabular">{a.current_level}</TableCell>
                      <TableCell className="tabular">
                        {a.current_streak}
                        <span className="text-xs text-muted-foreground"> / {a.longest_streak}</span>
                      </TableCell>
                      <TableCell className="tabular">{a.adherence}%</TableCell>
                      <TableCell>{a.city ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(a.joined).toLocaleDateString("en-US")}</TableCell>
                      <TableCell>
                        <Badge tone={appTone(a.status)}>{a.status}</Badge>
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        {(a.status === "applied" || a.status === "waitlisted") && (
                          <button className="text-xs font-medium text-primary hover:underline" onClick={() => setAction(decideSpec(rpc, a, "approved", reloadAll))}>
                            Approve
                          </button>
                        )}
                        {a.status === "applied" && (
                          <button className="text-xs font-medium text-muted-foreground hover:underline" onClick={() => setAction(decideSpec(rpc, a, "waitlisted", reloadAll))}>
                            Waitlist
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Pager page={appPage} pageSize={APPLICANTS_PAGE} total={applicants.length} onPage={setAppPage} unit="applicants" />
          </CardContent>
        </Card>
      )}

      {openWave && <OpenWaveModal onClose={() => setOpenWave(false)} onSaved={() => { setOpenWave(false); void loadWaves(); }} onError={setError} />}
      {action && <ActionRunner spec={action} onClose={() => setAction(null)} />}
    </>
  );
}

// ── action specs ──
function tierSpec(rpc: (fn: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>, a: Agent, done: () => void): ActionSpec {
  return {
    title: `Set tier — ${a.display_name ?? a.email}`,
    desc: "Manual tier override (audited). The automatic monthly recompute is not built yet.",
    confirmLabel: "Set tier",
    extra: [{ key: "tier", label: "Tier", type: "number", value: String(a.current_tier ?? 1) }],
    run: async (v) => {
      const r = await rpc("fn_admin_set_tier", { p_profile: a.profile_id, p_tier: Number(v.extra.tier), p_reason: v.reason });
      if (!r.error) done();
      return r;
    },
  };
}
function statusSpec(rpc: (fn: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>, a: Agent, status: string, done: () => void): ActionSpec {
  const verb = status === "offboarded" ? "Offboard" : status === "paused" ? "Pause" : "Resume";
  return {
    title: `${verb} — ${a.display_name ?? a.email}`,
    desc: status === "offboarded" ? "Their commission stops; referred members keep their discount." : undefined,
    confirmLabel: verb,
    destructive: status === "offboarded",
    run: async (v) => {
      const r = await rpc("fn_admin_set_referrer_status", { p_profile: a.profile_id, p_status: status, p_reason: v.reason });
      if (!r.error) done();
      return r;
    },
  };
}
function closeSpec(rpc: (fn: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>, w: Wave, done: () => void): ActionSpec {
  return {
    title: `Close "${w.name}"`,
    confirmLabel: "Close wave",
    run: async (v) => {
      const r = await rpc("fn_close_wave", { p_wave: w.id, p_reason: v.reason });
      if (!r.error) done();
      return r;
    },
  };
}
function decideSpec(rpc: (fn: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>, a: Applicant, decision: string, done: () => void): ActionSpec {
  return {
    title: `${decision === "approved" ? "Approve" : "Waitlist"} — ${a.display_name ?? a.email}`,
    desc: decision === "approved" ? "Grants the Agent surface + a ref code." : undefined,
    confirmLabel: decision === "approved" ? "Approve" : "Waitlist",
    run: async (v) => {
      const r = await rpc("fn_decide_application", { p_application: a.application_id, p_decision: decision, p_reason: v.reason });
      if (!r.error) done();
      return r;
    },
  };
}

function ActionRunner({ spec, onClose }: { spec: ActionSpec; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>(() =>
    Object.fromEntries((spec.extra ?? []).map((f) => [f.key, f.value ?? ""])),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const extraOk = (spec.extra ?? []).every((f) => (extra[f.key] ?? "").trim());
  const canRun = reason.trim() && extraOk;

  async function go() {
    setBusy(true);
    setErr(null);
    const { error } = await spec.run({ reason, extra });
    setBusy(false);
    if (error) setErr(error.message);
    else onClose();
  }

  return (
    <Modal open onClose={onClose} title={spec.title}>
      {spec.desc && <p className="text-sm text-muted-foreground">{spec.desc}</p>}
      {(spec.extra ?? []).map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label>{f.label}</Label>
          <Input type={f.type ?? "text"} placeholder={f.placeholder} value={extra[f.key] ?? ""} onChange={(e) => setExtra((s) => ({ ...s, [f.key]: e.target.value }))} />
        </div>
      ))}
      <div className="space-y-1.5">
        <Label>Reason (required — audited)</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {err && <p className="text-sm text-destructive">⚠️ {err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant={spec.destructive ? "destructive" : "default"} disabled={!canRun || busy} onClick={go}>
          {busy ? "Working…" : spec.confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

function OpenWaveModal({ onClose, onSaved, onError }: { onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [name, setName] = useState("");
  const [cap, setCap] = useState("30");
  const [city, setCity] = useState("");
  const [niche, setNiche] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("fn_open_wave", {
      p_name: name,
      p_soft_cap: cap ? Number(cap) : null,
      p_city_focus: city || null,
      p_niche_note: niche || null,
      p_reason: reason,
    });
    setBusy(false);
    if (error) onError(error.message);
    else onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Open intake wave">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="September wave" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Soft cap</Label>
          <Input type="number" value={cap} onChange={(e) => setCap(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>City focus (optional)</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Valjevo" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Niche note (optional)</Label>
        <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="gym owners, running clubs…" />
      </div>
      <div className="space-y-1.5">
        <Label>Reason</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="required" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!name || !reason.trim() || busy} onClick={save}>
          {busy ? "Opening…" : "Open wave"}
        </Button>
      </div>
    </Modal>
  );
}
