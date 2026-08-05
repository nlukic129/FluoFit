"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rsd } from "@/lib/overview";
import { supabase } from "@/lib/supabase/client";

type Batch = {
  id: string;
  period: string;
  status: string;
  total: number;
  referrer_count: number;
  commission_count: number;
  agency_invoice_ref: string | null;
  paid_at: string | null;
  created_at: string;
};

const statusTone = (s: string) => (s === "paid" ? "success" : s === "draft" ? "warning" : "neutral");

export default function PayoutsPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("fn_admin_list_payout_batches");
    if (error) setError(error.message);
    else setBatches((data as Batch[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function newRun() {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("fn_admin_create_payout_batch", { p_period: period });
    setBusy(false);
    if (error) setError(error.message);
    else if (data) router.push(`/payouts/${data as string}`);
  }

  return (
    <>
      <PageHeader title="Payouts" subtitle="Monthly payout to the marketing agency — one statement, one payment." />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>New payout run</CardTitle>
          <CardDescription>
            Batches all payable commissions (above the min threshold) into one agency statement. Below-threshold
            recipients roll over to the next run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input className="w-40" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-08" />
            <Button disabled={busy} onClick={newRun}>
              <Plus /> {busy ? "Creating…" : "New payout run"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Recipients</TableHead>
            <TableHead>Commissions</TableHead>
            <TableHead>Total → agency</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead>Paid</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={7}>
                No payout runs yet.
              </TableCell>
            </TableRow>
          ) : (
            batches.map((b) => (
              <TableRow key={b.id} className="cursor-pointer" onClick={() => router.push(`/payouts/${b.id}`)}>
                <TableCell className="font-medium">{b.period}</TableCell>
                <TableCell>
                  <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                </TableCell>
                <TableCell className="tabular">{b.referrer_count}</TableCell>
                <TableCell className="tabular">{b.commission_count}</TableCell>
                <TableCell className="tabular">{rsd(b.total)}</TableCell>
                <TableCell className="tabular text-muted-foreground">{b.agency_invoice_ref ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {b.paid_at ? new Date(b.paid_at).toLocaleDateString("en-US") : "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}
