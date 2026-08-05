"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Pager } from "@/components/pager";
import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rsd } from "@/lib/overview";
import { supabase } from "@/lib/supabase/client";

type Held = {
  id: string;
  amount: number;
  state: string;
  hold_until: string | null;
  days_left: number | null;
  referrer_id: string;
  referrer_email: string | null;
  referrer_name: string | null;
  referrer_type: string;
  member_id: string;
  member_email: string | null;
  member_name: string | null;
  sub_status: string;
  sub_age_days: number;
  order_amount: number | null;
  order_paid_at: string | null;
  rapid_churn: boolean;
  total_count: number;
};
type Summary = { in_hold_count: number; in_hold_sum: number; flagged_count: number; clearing_soon: number };
type Filter = "hold" | "flagged" | "all";

const PAGE_SIZE = 25;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "hold", label: "In hold" },
  { key: "flagged", label: "Flagged" },
  { key: "all", label: "All" },
];
const stateTone = (s: string) =>
  s === "paid" ? "success" : s === "clawed_back" ? "danger" : s === "payable" ? "info" : "warning";
const subTone = (s: string) => (s === "active" ? "success" : s === "lapsed" || s === "cancelled" ? "danger" : "warning");

export default function FraudPage() {
  const [filter, setFilter] = useState<Filter>("hold");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Held[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [act, setAct] = useState<{ row: Held; kind: "release" | "clawback" } | null>(null);

  useEffect(() => {
    setPage(0);
  }, [filter]);

  const load = useCallback(async () => {
    setError(null);
    const [list, sum] = await Promise.all([
      supabase.rpc("fn_admin_list_held_commissions", { p_filter: filter, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }),
      supabase.rpc("fn_admin_fraud_summary"),
    ]);
    if (list.error) setError(list.error.message);
    else {
      const r = (list.data as Held[]) ?? [];
      setRows(r);
      setTotal(r.length ? Number(r[0]!.total_count) : 0);
    }
    if (!sum.error) setSummary(sum.data as Summary);
  }, [filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const refHref = (r: Held) => (r.referrer_type === "agent" ? `/agents/${r.referrer_id}` : `/affiliates/${r.referrer_id}`);

  return (
    <>
      <PageHeader title="Fraud" subtitle="Held-commission review — catch bad commissions during the 30-day hold, before payout." />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Tile label="In hold" value={String(summary.in_hold_count)} sub={`${rsd(summary.in_hold_sum)} at risk`} />
          <Tile label="Flagged (rapid churn)" value={String(summary.flagged_count)} warn={summary.flagged_count > 0} />
          <Tile label="Clearing ≤ 3 days" value={String(summary.clearing_soon)} warn={summary.clearing_soon > 0} />
        </div>
      )}

      <div className="mb-3 flex gap-1">
        {FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => setFilter(f.key)}>
            {f.label}
          </Button>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Referrer</TableHead>
            <TableHead>Referred member</TableHead>
            <TableHead>Subscription</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Hold</TableHead>
            <TableHead>State</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={7}>
                Nothing to review here.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const inHold = r.state === "accrued" || r.state === "cleared";
              return (
                <TableRow key={r.id} className={r.rapid_churn ? "bg-amber-50/50" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link href={refHref(r)} className="font-medium hover:underline">
                        {r.referrer_name ?? r.referrer_email ?? "—"}
                      </Link>
                      <Badge tone={r.referrer_type === "agent" ? "info" : "neutral"}>{r.referrer_type}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{r.referrer_email}</div>
                  </TableCell>
                  <TableCell>
                    <Link href={`/members/${r.member_id}`} className="font-medium hover:underline">
                      {r.member_name ?? r.member_email ?? "—"}
                    </Link>
                    {r.rapid_churn && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                        <AlertTriangle className="size-3" /> rapid churn
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge tone={subTone(r.sub_status)}>{r.sub_status}</Badge>
                    <div className="text-xs text-muted-foreground">{r.sub_age_days}d old</div>
                  </TableCell>
                  <TableCell className="tabular">{rsd(r.amount)}</TableCell>
                  <TableCell className="tabular text-muted-foreground">
                    {inHold && r.days_left != null ? `${r.days_left}d left` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge tone={stateTone(r.state)}>{r.state}</Badge>
                  </TableCell>
                  <TableCell className="space-x-2 whitespace-nowrap text-right">
                    {inHold && (
                      <>
                        <button className="text-xs font-medium text-primary hover:underline" onClick={() => setAct({ row: r, kind: "release" })}>
                          Release
                        </button>
                        <button className="text-xs font-medium text-destructive hover:underline" onClick={() => setAct({ row: r, kind: "clawback" })}>
                          Clawback
                        </button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} unit="commissions" />

      {act && <ActionModal act={act} onClose={() => setAct(null)} onDone={load} />}
    </>
  );
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <Card className={warn ? "border-amber-300" : undefined}>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="tabular text-2xl font-semibold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ActionModal({ act, onClose, onDone }: { act: { row: Held; kind: "release" | "clawback" }; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const clawback = act.kind === "clawback";

  async function go() {
    setBusy(true);
    setErr(null);
    const rpc = clawback ? "fn_admin_clawback_commission" : "fn_admin_release_commission";
    const { error } = await supabase.rpc(rpc, { p_id: act.row.id, p_reason: reason });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      onDone();
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title={clawback ? "Clawback commission" : "Release commission"}>
      <p className="text-sm text-muted-foreground">
        {clawback
          ? `Void ${rsd(act.row.amount)} to ${act.row.referrer_name ?? act.row.referrer_email} — it will never pay out.`
          : `Release ${rsd(act.row.amount)} to ${act.row.referrer_name ?? act.row.referrer_email} early (→ payable, skips the rest of the hold).`}
      </p>
      <div className="space-y-1.5">
        <Label>Reason (required — audited)</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {err && <p className="text-sm text-destructive">⚠️ {err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant={clawback ? "destructive" : "default"} disabled={!reason.trim() || busy} onClick={go}>
          {busy ? "Working…" : clawback ? "Clawback" : "Release"}
        </Button>
      </div>
    </Modal>
  );
}
