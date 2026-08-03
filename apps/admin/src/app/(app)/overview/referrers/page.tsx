"use client";

import { useOverviewData } from "@/components/overview-filters";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rsd } from "@/lib/overview";

export default function ReferrersPage() {
  const { o, error } = useOverviewData();
  if (error) return <p className="text-sm text-destructive">⚠️ {error}</p>;
  if (!o) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Referrer earnings</CardTitle>
        <CardDescription>Agents &amp; Affiliates by lifetime commission. Period toggle lands next.</CardDescription>
      </CardHeader>
      <CardContent className="pt-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referrer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Active subs</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Pending</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {o.top_referrers.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={6}>
                  No agents or affiliates yet.
                </TableCell>
              </TableRow>
            ) : (
              o.top_referrers.map((r) => (
                <TableRow key={r.ref_code}>
                  <TableCell className="font-medium">{r.email}</TableCell>
                  <TableCell>
                    <Badge tone={r.type === "agent" ? "info" : "neutral"}>{r.type}</Badge>
                  </TableCell>
                  <TableCell className="tabular">{r.active_subs}</TableCell>
                  <TableCell className="tabular">{rsd(r.paid)}</TableCell>
                  <TableCell className="tabular text-muted-foreground">{rsd(r.pending)}</TableCell>
                  <TableCell className="tabular font-semibold">{rsd(r.total)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
