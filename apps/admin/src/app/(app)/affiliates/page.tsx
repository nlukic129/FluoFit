"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
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

type Affiliate = {
  profile_id: string;
  email: string | null;
  display_name: string | null;
  status: string;
  ref_code: string;
  fixed_pct: number | null;
  buyer_discount_pct: number | null;
  active_subs: number;
  paid_earnings: number;
  pending_earnings: number;
  total_count: number;
};

type ActionSpec = {
  title: string;
  desc?: string;
  confirmLabel: string;
  destructive?: boolean;
  extra?: { key: string; label: string; type?: string; value?: string }[];
  run: (v: { reason: string; extra: Record<string, string> }) => Promise<{ error: { message: string } | null }>;
};

const PAGE_SIZE = 20;
const statusTone = (s: string) => (s === "active" ? "success" : s === "paused" ? "warning" : "neutral");
const pctText = (n: number | null) => (n != null ? `${n}%` : "—");

export default function AffiliatesPage() {
  const [rows, setRows] = useState<Affiliate[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [action, setAction] = useState<ActionSpec | null>(null);

  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(fn, args);
    if (!error) await load();
    return { error };
  };

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("fn_admin_list_referrers", {
      p_type: "affiliate",
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    });
    if (error) setError(error.message);
    else {
      const r = (data as Affiliate[]) ?? [];
      setRows(r);
      setTotal(r.length ? Number(r[0]!.total_count) : 0);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Affiliates"
        subtitle="Curated referrers on manually-set commission + buyer-discount rates."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add affiliate
          </Button>
        }
      />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Affiliate</TableHead>
            <TableHead>Ref code</TableHead>
            <TableHead>Commission</TableHead>
            <TableHead>Buyer discount</TableHead>
            <TableHead>Active subs</TableHead>
            <TableHead>Pending</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={9}>
                No affiliates yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.profile_id}>
                <TableCell>
                  <Link href={`/affiliates/${r.profile_id}`} className="font-medium hover:underline">
                    {r.display_name ?? r.email ?? "—"}
                  </Link>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </TableCell>
                <TableCell className="tabular">{r.ref_code}</TableCell>
                <TableCell className="tabular">{pctText(r.fixed_pct)}</TableCell>
                <TableCell className="tabular">{pctText(r.buyer_discount_pct)}</TableCell>
                <TableCell className="tabular">{r.active_subs}</TableCell>
                <TableCell className="tabular">{rsd(r.pending_earnings)}</TableCell>
                <TableCell className="tabular">{rsd(r.paid_earnings)}</TableCell>
                <TableCell>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </TableCell>
                <TableCell className="space-x-2 whitespace-nowrap text-right">
                  {r.status !== "offboarded" && (
                    <>
                      <button className="text-xs font-medium text-primary hover:underline" onClick={() => setAction(ratesSpec(rpc, r))}>
                        Rates
                      </button>
                      <button className="text-xs font-medium text-primary hover:underline" onClick={() => setAction(statusSpec(rpc, r, r.status === "paused" ? "active" : "paused"))}>
                        {r.status === "paused" ? "Resume" : "Pause"}
                      </button>
                      <button className="text-xs font-medium text-destructive hover:underline" onClick={() => setAction(statusSpec(rpc, r, "offboarded"))}>
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
      <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} unit="affiliates" />

      {adding && <AddAffiliateModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void load(); }} onError={setError} />}
      {action && <ActionRunner spec={action} onClose={() => setAction(null)} />}
    </>
  );
}

type Rpc = (fn: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;

function ratesSpec(rpc: Rpc, r: Affiliate): ActionSpec {
  return {
    title: `Edit rates — ${r.display_name ?? r.email}`,
    desc: "Commission applies to future purchases; buyer discount applies to NEW subscribers only.",
    confirmLabel: "Save rates",
    extra: [
      { key: "commission", label: "Commission % (affiliate earns)", type: "number", value: String(r.fixed_pct ?? "") },
      { key: "discount", label: "Buyer discount % (their members get)", type: "number", value: String(r.buyer_discount_pct ?? "") },
    ],
    run: (v) =>
      rpc("fn_admin_set_affiliate_rates", {
        p_profile: r.profile_id,
        p_commission: v.extra.commission === "" ? null : Number(v.extra.commission),
        p_buyer_discount: v.extra.discount === "" ? null : Number(v.extra.discount),
        p_reason: v.reason,
      }),
  };
}
function statusSpec(rpc: Rpc, r: Affiliate, status: string): ActionSpec {
  const verb = status === "offboarded" ? "Offboard" : status === "paused" ? "Pause" : "Resume";
  return {
    title: `${verb} — ${r.display_name ?? r.email}`,
    desc: status === "offboarded" ? "Their commission stops; referred members keep their discount." : undefined,
    confirmLabel: verb,
    destructive: status === "offboarded",
    run: (v) => rpc("fn_admin_set_referrer_status", { p_profile: r.profile_id, p_status: status, p_reason: v.reason }),
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

function AddAffiliateModal({ onClose, onSaved, onError }: { onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [email, setEmail] = useState("");
  const [pct, setPct] = useState("");
  const [discount, setDiscount] = useState("10");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("fn_add_affiliate", {
      p_email: email,
      p_fixed_pct: Number(pct),
      p_buyer_discount: Number(discount),
      p_reason: reason,
    });
    setBusy(false);
    if (error) onError(error.message);
    else onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Add affiliate">
      <p className="text-sm text-muted-foreground">The person must already have a FluoFit account (they sign up first).</p>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="trainer@example.com" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Commission %</Label>
          <Input type="number" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="15" />
        </div>
        <div className="space-y-1.5">
          <Label>Buyer discount %</Label>
          <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="10" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Reason</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="required" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!email.includes("@") || !pct || !discount || !reason.trim() || busy} onClick={save}>
          {busy ? "Adding…" : "Add affiliate"}
        </Button>
      </div>
    </Modal>
  );
}
