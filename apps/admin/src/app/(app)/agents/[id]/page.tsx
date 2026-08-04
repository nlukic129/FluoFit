"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rsd } from "@/lib/overview";
import { supabase } from "@/lib/supabase/client";

type ReferrerDetail = {
  profile_id: string;
  email: string | null;
  name: string | null;
  kind: string;
  status: string;
  ref_code: string;
  fixed_pct: number | null;
  current_tier: number | null;
  eligibility_met_at: string | null;
  active_subs: number;
  earnings: { accrued: number; cleared: number; payable: number; paid: number; clawed_back: number; total: number };
  referred: { member_id: string; member_email: string | null; member_name: string | null; sub_status: string; earned: number }[];
};

type ActionSpec = {
  title: string;
  desc?: string;
  confirmLabel: string;
  destructive?: boolean;
  extra?: { key: string; label: string; type?: string; value?: string }[];
  run: (v: { reason: string; extra: Record<string, string> }) => Promise<{ error: { message: string } | null }>;
};

const statusTone = (s: string) => (s === "active" ? "success" : s === "paused" ? "warning" : "neutral");
const subTone = (s: string) => (s === "active" ? "success" : s === "lapsed" || s === "cancelled" ? "danger" : "warning");

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<ReferrerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<ActionSpec | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("fn_admin_referrer_detail", { p_profile: id });
    if (error) setError(error.message);
    else setD(data as ReferrerDetail);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(fn, args);
    if (!error) await load();
    return { error };
  };

  if (error) return <p className="text-sm text-destructive">⚠️ {error}</p>;
  if (!d) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const e = d.earnings;
  const bd = [
    { k: "Accrued", v: e.accrued },
    { k: "Cleared", v: e.cleared },
    { k: "Payable", v: e.payable },
    { k: "Paid", v: e.paid },
    { k: "Clawed back", v: e.clawed_back },
    { k: "Total", v: e.total },
  ];

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => router.push("/agents")}>
        <ArrowLeft /> Agents
      </Button>
      <PageHeader
        title={d.name ?? d.email ?? "Agent"}
        subtitle={`${d.email ?? ""} · ${d.kind} · ref ${d.ref_code}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(d.status)}>{d.status}</Badge>
            {d.status !== "offboarded" && (
              <>
                <Button size="sm" variant="outline" onClick={() => setAction(tierSpec(rpc, d))}>Set tier</Button>
                <Button size="sm" variant="outline" onClick={() => setAction(statusSpec(rpc, d, d.status === "paused" ? "active" : "paused"))}>
                  {d.status === "paused" ? "Resume" : "Pause"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setAction(statusSpec(rpc, d, "offboarded"))}>Offboard</Button>
              </>
            )}
          </div>
        }
      />

      {/* Header stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Tier" value={d.current_tier ?? "—"} />
        <Stat label="Active subs" value={d.active_subs} />
        <Stat label="Pending" value={rsd(e.accrued + e.cleared + e.payable)} />
        <Stat label="Paid" value={rsd(e.paid)} />
      </div>

      {/* Earnings breakdown */}
      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Earnings by state</CardTitle>
          <Link href="/fraud" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Review on Fraud <ExternalLink className="size-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
            {bd.map((b) => (
              <div key={b.k}>
                <div className="text-xs text-muted-foreground">{b.k}</div>
                <div className="tabular text-lg font-semibold">{rsd(b.v)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Referred subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Referred members ({d.referred.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead className="text-right">Earned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.referred.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={3}>
                    No referred members yet.
                  </TableCell>
                </TableRow>
              ) : (
                d.referred.map((r) => (
                  <TableRow key={r.member_id} className="cursor-pointer" onClick={() => router.push(`/members/${r.member_id}`)}>
                    <TableCell>
                      <div className="font-medium">{r.member_name ?? r.member_email ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.member_email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge tone={subTone(r.sub_status)}>{r.sub_status}</Badge>
                    </TableCell>
                    <TableCell className="tabular text-right">{rsd(r.earned)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {action && <ActionRunner spec={action} onClose={() => setAction(null)} />}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="tabular text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function tierSpec(rpc: (fn: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>, d: ReferrerDetail): ActionSpec {
  return {
    title: "Set tier",
    desc: "Manual tier override (audited). The automatic monthly recompute is not built yet.",
    confirmLabel: "Set tier",
    extra: [{ key: "tier", label: "Tier", type: "number", value: String(d.current_tier ?? 1) }],
    run: (v) => rpc("fn_admin_set_tier", { p_profile: d.profile_id, p_tier: Number(v.extra.tier), p_reason: v.reason }),
  };
}
function statusSpec(rpc: (fn: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>, d: ReferrerDetail, status: string): ActionSpec {
  const verb = status === "offboarded" ? "Offboard" : status === "paused" ? "Pause" : "Resume";
  return {
    title: verb,
    desc: status === "offboarded" ? "Their commission stops; referred members keep their discount." : undefined,
    confirmLabel: verb,
    destructive: status === "offboarded",
    run: (v) => rpc("fn_admin_set_referrer_status", { p_profile: d.profile_id, p_status: status, p_reason: v.reason }),
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
          <Input type={f.type ?? "text"} value={extra[f.key] ?? ""} onChange={(ev) => setExtra((s) => ({ ...s, [f.key]: ev.target.value }))} />
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
