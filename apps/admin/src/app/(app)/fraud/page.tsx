"use client";

import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";

type Commission = {
  id: string;
  email: string | null;
  amount: number;
  state: string;
  hold_until: string | null;
  created_at: string;
};

type Filter = "accrued" | "cleared" | "payable" | "all";
const FILTERS: Filter[] = ["accrued", "cleared", "payable", "all"];
const stateTone = (s: string) =>
  s === "paid" ? "success" : s === "clawed_back" ? "danger" : s === "payable" ? "info" : "warning";

export default function FraudPage() {
  const [filter, setFilter] = useState<Filter>("accrued");
  const [rows, setRows] = useState<Commission[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase.rpc("fn_admin_list_commissions", {
      p_state: filter === "all" ? null : filter,
    });
    if (error) setError(error.message);
    else setRows((data as Commission[]) ?? []);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, kind: "release" | "clawback") {
    const reason = window.prompt(`${kind} this commission? Reason:`);
    if (!reason) return;
    const rpc = kind === "release" ? "fn_admin_release_commission" : "fn_admin_clawback_commission";
    const { error } = await supabase.rpc(rpc, { p_id: id, p_reason: reason });
    if (error) setError(error.message);
    else await load();
  }

  return (
    <>
      <PageHeader title="Fraud" subtitle="Review held commissions — release after review, or claw back." />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <div className="mb-3 flex gap-1">
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f[0]!.toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Referrer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={5}>
                No commissions in this state.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.email ?? "—"}</TableCell>
                <TableCell className="tabular">€{Number(c.amount).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge tone={stateTone(c.state)}>{c.state}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("en-US")}
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  {(c.state === "accrued" || c.state === "cleared") && (
                    <Button size="sm" onClick={() => act(c.id, "release")}>
                      Release
                    </Button>
                  )}
                  {c.state !== "paid" && c.state !== "clawed_back" && (
                    <Button size="sm" variant="destructive" onClick={() => act(c.id, "clawback")}>
                      Clawback
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}
