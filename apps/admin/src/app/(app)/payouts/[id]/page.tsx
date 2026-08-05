"use client";

import { ArrowLeft, Download } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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

type Line = {
  referrer_id: string;
  email: string | null;
  name: string | null;
  ref_code: string;
  kind: string;
  commission_count: number;
  amount: number;
};
type Detail = {
  id: string;
  period: string;
  status: string;
  total: number;
  referrer_count: number;
  commission_count: number;
  agency_invoice_ref: string | null;
  paid_at: string | null;
  created_at: string;
  agent_total: number;
  affiliate_total: number;
  lines: Line[];
};

const statusTone = (s: string) => (s === "paid" ? "success" : s === "draft" ? "warning" : "neutral");

export default function PayoutBatchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"paid" | "cancel" | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("fn_admin_payout_batch_detail", { p_batch: id });
    if (error) setError(error.message);
    else setD(data as Detail);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    if (!d) return;
    const rows = [
      ["email", "ref_code", "type", "commissions", "amount_rsd"],
      ...d.lines.map((l) => [l.email ?? "", l.ref_code, l.kind, String(l.commission_count), String(l.amount)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `payout-${d.period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) return <p className="text-sm text-destructive">⚠️ {error}</p>;
  if (!d) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => router.push("/payouts")}>
        <ArrowLeft /> Payouts
      </Button>
      <PageHeader
        title={`Payout ${d.period}`}
        subtitle={`Created ${new Date(d.created_at).toLocaleDateString("en-US")}${d.paid_at ? ` · paid ${new Date(d.paid_at).toLocaleDateString("en-US")} · invoice ${d.agency_invoice_ref}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(d.status)}>{d.status}</Badge>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download /> Export CSV
            </Button>
            {d.status === "draft" && (
              <>
                <Button size="sm" onClick={() => setModal("paid")}>Mark paid</Button>
                <Button size="sm" variant="outline" onClick={() => setModal("cancel")}>Cancel</Button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="Total → agency" value={rsd(d.total)} />
        <Tile label="Agents" value={rsd(d.agent_total)} />
        <Tile label="Affiliates" value={rsd(d.affiliate_total)} />
        <Tile label="Recipients" value={String(d.referrer_count)} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Ref code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Commissions</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.lines.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={5}>No lines.</TableCell>
                </TableRow>
              ) : (
                d.lines.map((l) => (
                  <TableRow key={l.referrer_id}>
                    <TableCell>
                      <div className="font-medium">{l.name ?? l.email ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{l.email}</div>
                    </TableCell>
                    <TableCell className="tabular">{l.ref_code}</TableCell>
                    <TableCell>
                      <Badge tone={l.kind === "agent" ? "info" : "neutral"}>{l.kind}</Badge>
                    </TableCell>
                    <TableCell className="tabular text-right">{l.commission_count}</TableCell>
                    <TableCell className="tabular text-right">{rsd(l.amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {modal === "paid" && <MarkPaidModal batchId={d.id} total={d.total} onClose={() => setModal(null)} onDone={load} />}
      {modal === "cancel" && <CancelModal batchId={d.id} onClose={() => setModal(null)} onDone={load} />}
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="tabular text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function MarkPaidModal({ batchId, total, onClose, onDone }: { batchId: string; total: number; onClose: () => void; onDone: () => void }) {
  const [invoice, setInvoice] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("fn_admin_mark_batch_paid", { p_batch: batchId, p_invoice_ref: invoice, p_reason: reason });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      onDone();
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title="Mark paid to agency">
      <p className="text-sm text-muted-foreground">
        Confirms FluoFit paid the agency <span className="font-medium text-foreground">{rsd(total)}</span>. Records the
        invoice + date and marks all commissions in this batch paid.
      </p>
      <div className="space-y-1.5">
        <Label>Agency invoice reference</Label>
        <Input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="INV-2026-08-001" />
      </div>
      <div className="space-y-1.5">
        <Label>Reason (audited)</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {err && <p className="text-sm text-destructive">⚠️ {err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!invoice.trim() || !reason.trim() || busy} onClick={go}>
          {busy ? "Saving…" : "Mark paid"}
        </Button>
      </div>
    </Modal>
  );
}

function CancelModal({ batchId, onClose, onDone }: { batchId: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("fn_admin_cancel_payout_batch", { p_batch: batchId, p_reason: reason });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      onDone();
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title="Cancel draft batch">
      <p className="text-sm text-muted-foreground">Releases these commissions back to the payable pool for a future run.</p>
      <div className="space-y-1.5">
        <Label>Reason (audited)</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {err && <p className="text-sm text-destructive">⚠️ {err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Keep</Button>
        <Button variant="destructive" disabled={!reason.trim() || busy} onClick={go}>
          {busy ? "Cancelling…" : "Cancel batch"}
        </Button>
      </div>
    </Modal>
  );
}
