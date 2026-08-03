"use client";

import { Wallet } from "lucide-react";

import { AreaTrend } from "@/components/charts";
import { useOverviewData } from "@/components/overview-filters";
import { SectionTitle, Tile } from "@/components/overview-bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { rsd } from "@/lib/overview";

export default function FinancialPage() {
  const { o, error } = useOverviewData();
  if (error) return <p className="text-sm text-destructive">⚠️ {error}</p>;
  if (!o) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const commTotal = o.commissions.accrued + o.commissions.payable + o.commissions.paid;
  const netAfterComm = o.kpis.revenue_period - o.commissions.paid;

  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Tile label="Revenue (period)" value={rsd(o.kpis.revenue_period)} icon={Wallet} />
          <Tile label="Gross margin (period)" value={rsd(o.margin.gross_margin_period)} sub={`${o.margin.margin_pct}% margin`} icon={Wallet} />
          <Tile label="ARPU" value={o.kpis.arpu != null ? rsd(o.kpis.arpu) : "—"} icon={Wallet} />
          <Tile label="LTV (est)" value={rsd(o.margin.ltv_est)} icon={Wallet} />
          <Tile label="Net after commissions" value={rsd(netAfterComm)} sub="revenue − paid commissions" icon={Wallet} />
          <Tile label="Pending payout" value={rsd(o.kpis.pending_payout)} icon={Wallet} />
        </div>
      </section>

      <section>
        <SectionTitle>Revenue</SectionTitle>
        <Card>
          <CardContent className="pt-5">
            <AreaTrend data={o.revenue_series} gradientId="fin-rev" color="#1E40AF" suffix=" RSD" height={260} />
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionTitle>Commissions &amp; payout</SectionTitle>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Payout pipeline</CardTitle>
              <CardDescription>Accrued → Cleared → Payable → Paid</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-1">
              <Bar label="Accrued (held)" value={o.commissions.accrued} max={commTotal} color="#D97706" />
              <Bar label="Payable" value={o.commissions.payable} max={commTotal} color="#1E40AF" />
              <Bar label="Paid" value={o.commissions.paid} max={commTotal} color="#059669" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Margin &amp; LTV</CardTitle>
              <CardDescription>From pricing config; LTV is an estimate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-1 text-sm">
              <MLine k="Box price" v={rsd(o.margin.box_price)} />
              <MLine k="COGS per box" v={rsd(o.margin.cogs_per_box)} />
              <MLine k="Unit margin" v={`${rsd(o.margin.unit_margin)} (${o.margin.margin_pct}%)`} />
              <MLine k="Gross margin (period)" v={rsd(o.margin.gross_margin_period)} />
              <MLine k="LTV (est)" v={rsd(o.margin.ltv_est)} />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function MLine({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="tabular font-medium">{v}</span>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular font-medium">{rsd(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full" style={{ width: `${w}%`, background: color }} />
      </div>
    </div>
  );
}
