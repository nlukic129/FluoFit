"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { SubscriberMap, type MapPoint } from "@/components/subscriber-map";
import { useOverviewFilters } from "@/components/overview-filters";
import { SectionTitle } from "@/components/overview-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";

const STATUSES: { key: string; label: string }[] = [
  { key: "", label: "All ever" },
  { key: "active", label: "Active" },
  { key: "churned", label: "Churned" },
  { key: "paused", label: "Paused" },
];

const isChurned = (s: string) => s === "lapsed" || s === "cancelled";

export default function GeographyPage() {
  const { city } = useOverviewFilters();
  const [status, setStatus] = useState("");
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("fn_admin_subscriber_map", { p_status: status || null });
    if (error) setError(error.message);
    else setPoints((data as MapPoint[]) ?? []);
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => (city ? points.filter((p) => p.city === city) : points), [points, city]);

  // "Where are we strong / weak" — per-city active vs churned.
  const byCity = useMemo(() => {
    const m = new Map<string, { city: string; active: number; churned: number; paused: number; total: number }>();
    for (const p of filtered) {
      const c = p.city ?? "—";
      const row = m.get(c) ?? { city: c, active: 0, churned: 0, paused: 0, total: 0 };
      row.total += 1;
      if (p.sub_status === "active") row.active += 1;
      else if (p.sub_status === "paused") row.paused += 1;
      else if (isChurned(p.sub_status)) row.churned += 1;
      m.set(c, row);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [filtered]);

  if (error) return <p className="text-sm text-destructive">⚠️ {error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <Button key={s.key || "all"} size="sm" variant={status === s.key ? "default" : "outline"} onClick={() => setStatus(s.key)}>
              {s.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Legend color="#059669" label="active" />
          <Legend color="#D97706" label="paused" />
          <Legend color="#DC2626" label="churned" />
          <span className="tabular font-medium text-foreground">{filtered.length} subscribers</span>
        </div>
      </div>

      <SubscriberMap points={filtered} />

      <section>
        <SectionTitle hint="where we're strong / weak">By city</SectionTitle>
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Paused</TableHead>
                  <TableHead className="text-right">Churned</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Retention</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCity.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={6}>No subscribers.</TableCell>
                  </TableRow>
                ) : (
                  byCity.map((r) => {
                    const ret = r.total > 0 ? Math.round((r.active / r.total) * 100) : 0;
                    return (
                      <TableRow key={r.city}>
                        <TableCell className="font-medium">{r.city}</TableCell>
                        <TableCell className="tabular text-right text-emerald-600">{r.active}</TableCell>
                        <TableCell className="tabular text-right text-amber-600">{r.paused}</TableCell>
                        <TableCell className="tabular text-right text-red-600">{r.churned}</TableCell>
                        <TableCell className="tabular text-right">{r.total}</TableCell>
                        <TableCell className={`tabular text-right font-medium ${ret >= 70 ? "text-emerald-600" : ret >= 50 ? "text-amber-600" : "text-red-600"}`}>
                          {ret}%
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
