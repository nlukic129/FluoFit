"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";

type Entry = {
  id: string;
  actor_email: string | null;
  action: string;
  target_table: string | null;
  reason: string | null;
  at: string;
};

export default function AuditPage() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("fn_admin_list_audit", { p_limit: 300 });
      if (error) setError(error.message);
      else setRows((data as Entry[]) ?? []);
    })();
  }, []);

  const filtered = useMemo(
    () =>
      filter
        ? rows.filter(
            (r) =>
              r.action.toLowerCase().includes(filter.toLowerCase()) ||
              (r.actor_email ?? "").toLowerCase().includes(filter.toLowerCase()),
          )
        : rows,
    [rows, filter],
  );

  return (
    <>
      <PageHeader title="Audit Log" subtitle="Every mutating admin action: who, when, what, why." />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <div className="mb-3 max-w-sm">
        <Input placeholder="Filter by action or actor…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={5}>
                No audit entries.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(r.at).toLocaleString("en-US")}
                </TableCell>
                <TableCell>{r.actor_email ?? "—"}</TableCell>
                <TableCell>
                  <Badge tone="info">{r.action}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.target_table ?? "—"}</TableCell>
                <TableCell>{r.reason ?? "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}
