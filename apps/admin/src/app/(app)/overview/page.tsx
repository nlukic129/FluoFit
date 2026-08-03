"use client";

import { Boxes, LifeBuoy, Users, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";

type Kpis = {
  activeSubs: number | null;
  activatedBoxes: number | null;
  pendingPayout: number | null;
  openTickets: number | null;
};

export default function OverviewPage() {
  const [kpis, setKpis] = useState<Kpis>({
    activeSubs: null,
    activatedBoxes: null,
    pendingPayout: null,
    openTickets: null,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [subs, boxes, payable, tickets] = await Promise.all([
        supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("boxes").select("*", { count: "exact", head: true }).eq("status", "activated"),
        supabase.from("commissions").select("amount").eq("state", "payable"),
        supabase.from("support_tickets").select("*", { count: "exact", head: true }).eq("status", "open"),
      ]);
      const firstError = subs.error ?? boxes.error ?? payable.error ?? tickets.error;
      if (firstError) setError(firstError.message);
      const payoutSum = (payable.data ?? []).reduce(
        (sum, r) => sum + Number((r as { amount: number }).amount ?? 0),
        0,
      );
      setKpis({
        activeSubs: subs.count ?? 0,
        activatedBoxes: boxes.count ?? 0,
        pendingPayout: payoutSum,
        openTickets: tickets.count ?? 0,
      });
    })();
  }, []);

  const cards = [
    { label: "Active subscriptions", value: fmt(kpis.activeSubs), icon: Users },
    { label: "Boxes activated", value: fmt(kpis.activatedBoxes), icon: Boxes },
    { label: "Pending payout", value: kpis.pendingPayout == null ? "—" : `€${kpis.pendingPayout.toFixed(2)}`, icon: Wallet },
    { label: "Open tickets", value: fmt(kpis.openTickets), icon: LifeBuoy },
  ];

  return (
    <>
      <PageHeader title="Overview" subtitle="Operational snapshot of the FluoFit platform." />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="tabular text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function fmt(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("en-US");
}
