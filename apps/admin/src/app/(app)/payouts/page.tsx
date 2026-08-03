"use client";

import { useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";

type Line = {
  referrer_id: string;
  email: string | null;
  ref_code: string;
  total: number;
  commission_count: number;
};

export default function PayoutsPage() {
  const now = "current period";
  const [period, setPeriod] = useState(now);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    const { data, error } = await supabase.rpc("fn_generate_payout_statement", { p_period: period });
    if (error) setError(error.message);
    else setLines((data as Line[]) ?? []);
  }

  async function markPaid(line: Line) {
    const reason = window.prompt(`Mark ${line.email} paid (agency confirmed)? Reason:`);
    if (!reason) return;
    const { error } = await supabase.rpc("fn_mark_referrer_paid", {
      p_referrer: line.referrer_id,
      p_reason: reason,
    });
    if (error) setError(error.message);
    else await generate();
  }

  const grandTotal = (lines ?? []).reduce((s, l) => s + Number(l.total), 0);

  return (
    <>
      <PageHeader title="Payouts" subtitle="Monthly statement of payable commissions → the agency (ADR-0008)." />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generate statement</CardTitle>
          <CardDescription>Lists payable amounts per recipient. Mark paid on agency confirmation.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-08" />
            <Button onClick={generate}>Generate</Button>
          </div>
        </CardContent>
      </Card>

      {lines !== null && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Ref code</TableHead>
              <TableHead>Commissions</TableHead>
              <TableHead>Payable</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={5}>
                  Nothing payable right now.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {lines.map((l) => (
                  <TableRow key={l.referrer_id}>
                    <TableCell className="font-medium">{l.email ?? "—"}</TableCell>
                    <TableCell className="tabular">{l.ref_code}</TableCell>
                    <TableCell className="tabular">{l.commission_count}</TableCell>
                    <TableCell className="tabular">€{Number(l.total).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => markPaid(l)}>
                        Mark paid
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-semibold" colSpan={3}>
                    Total
                  </TableCell>
                  <TableCell className="tabular font-semibold">€{grandTotal.toFixed(2)}</TableCell>
                  <TableCell />
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      )}
    </>
  );
}
