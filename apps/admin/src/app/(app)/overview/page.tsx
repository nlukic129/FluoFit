"use client";

import { AlertTriangle, Clock, LifeBuoy, PackageX, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AreaTrend } from "@/components/charts";
import { useOverviewFilters } from "@/components/overview-filters";
import { DeltaKpi, SectionTitle, Tile } from "@/components/overview-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, rsd, type Overview, type Summary } from "@/lib/overview";
import { supabase } from "@/lib/supabase/client";

const pct = (cur: number, prev: number): number | null => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

export default function SummaryPage() {
  const { from, to, city, label } = useOverviewFilters();
  const [s, setS] = useState<Summary | null>(null);
  const [o, setO] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const args = { p_from: from.toISOString(), p_to: to.toISOString(), p_city: city || null };
    const [sum, ov] = await Promise.all([
      supabase.rpc("fn_admin_summary", args),
      supabase.rpc("fn_admin_overview", args),
    ]);
    if (sum.error) setError(sum.error.message);
    else setS(sum.data as Summary);
    if (!ov.error) setO(ov.data as Overview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.getTime(), to.getTime(), city]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="text-sm text-destructive">⚠️ {error}</p>;
  if (!s) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const na = s.needs_attention;
  const attentions: { label: string; value: number; sub?: string; href: string; icon: typeof Clock; warn: boolean; global?: boolean }[] = [
    { label: "Lapse-risk (≤5 days)", value: na.lapse_risk, sub: "about to lapse", href: "/members?flag=lapse_risk", icon: Clock, warn: na.lapse_risk > 0 },
    { label: "Smart, not scanning", value: na.smart_pending, sub: "paid, never scanned", href: "/members?flag=smart_pending", icon: AlertTriangle, warn: na.smart_pending > 0 },
    { label: "Held commissions", value: na.held_commissions_n, sub: `${rsd(na.held_commissions_sum)} · to review`, href: "/fraud", icon: ShieldAlert, warn: na.held_commissions_n > 0, global: true },
    { label: "Expiring stock", value: na.expiring_stock, sub: "unbound, ≤90 days to expiry", href: "/provisioning/boxes?flag=expiring", icon: PackageX, warn: na.expiring_stock > 0, global: true },
    { label: "Open tickets", value: na.open_tickets, sub: "in the queue", href: "/support", icon: LifeBuoy, warn: na.open_tickets > 0 },
  ];

  return (
    <div className="space-y-8">
      {/* Live snapshot */}
      <section>
        <SectionTitle hint="live snapshot">Right now</SectionTitle>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Tile label="Active members" value={num(s.kpis.active_members)} icon={Users} />
          <Link href="/payouts" className="transition-opacity hover:opacity-80">
            <Card>
              <CardContent className="p-4">
                <span className="text-xs text-muted-foreground">Pending payout</span>
                <div className="tabular mt-1 text-2xl font-semibold">{rsd(s.kpis.pending_payout)}</div>
                <div className="text-xs text-muted-foreground">ready to pay → Payouts</div>
                <AllCities />
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Needs attention — live operational alerts */}
      <section>
        <SectionTitle hint="live">Needs attention</SectionTitle>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {attentions.map((a) => (
            <Link key={a.label} href={a.href}>
              <Card className={a.warn ? "border-amber-300 transition-colors hover:border-amber-400" : "transition-colors hover:border-border"}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{a.label}</span>
                    <a.icon className={a.warn ? "size-4 text-amber-500" : "size-4 text-muted-foreground"} />
                  </div>
                  <div className="tabular mt-1 text-xl font-semibold">{a.value}</div>
                  {a.sub && <div className="mt-0.5 text-xs text-muted-foreground">{a.sub}</div>}
                  {a.global && <AllCities />}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Reacts to the date + city filters */}
      <section>
        <SectionTitle hint={label}>Selected period</SectionTitle>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <DeltaKpi label="Revenue" value={rsd(s.kpis.revenue_period)} delta={pct(s.kpis.revenue_period, s.kpis_prev.revenue_period)} />
          <DeltaKpi label="New members" value={num(s.kpis.new_members)} delta={pct(s.kpis.new_members, s.kpis_prev.new_members)} />
          <DeltaKpi label="Lapsed" value={num(s.kpis.lapsed_period)} delta={pct(s.kpis.lapsed_period, s.kpis_prev.lapsed_period)} goodWhenUp={false} />
          <Tile label="ARPU" value={s.kpis.arpu != null ? rsd(s.kpis.arpu) : "—"} />
        </div>
      </section>

      {/* Mini trends */}
      {o && (
        <section>
          <SectionTitle hint={label}>Trends</SectionTitle>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Revenue</CardTitle></CardHeader>
              <CardContent><AreaTrend data={o.revenue_series} gradientId="s-rev" color="#1E40AF" suffix=" RSD" height={160} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>New members</CardTitle></CardHeader>
              <CardContent><AreaTrend data={o.signups_series} gradientId="s-signup" color="#3B82F6" height={160} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Daily scans</CardTitle></CardHeader>
              <CardContent><AreaTrend data={o.scans_series} gradientId="s-scans" color="#059669" height={160} /></CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}

// Marker for metrics that are global (not filtered by the selected city).
function AllCities() {
  return <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/60">all cities</div>;
}
