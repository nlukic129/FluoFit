"use client";

import { Boxes, TrendingDown, TrendingUp } from "lucide-react";

import { AreaTrend } from "@/components/charts";
import { useOverviewData } from "@/components/overview-filters";
import { SectionTitle, Tile } from "@/components/overview-bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { num } from "@/lib/overview";

export default function RetentionPage() {
  const { o, error } = useOverviewData();
  if (error) return <p className="text-sm text-destructive">⚠️ {error}</p>;
  if (!o) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="Avg adherence" value={`${o.engagement.avg_adherence}%`} icon={TrendingUp} />
        <Tile label="Lapsed / cancelled" value={num(o.kpis.lapsed)} icon={TrendingDown} />
        <Tile label="Aged sachets" value={num(o.engagement.aged_sachets)} sub="unscanned, lapsed" icon={Boxes} />
        <Tile label="Active subs" value={num(o.kpis.active_subs)} icon={TrendingUp} />
      </div>

      <section>
        <SectionTitle>Engagement</SectionTitle>
        <Card>
          <CardHeader><CardTitle>Daily scans</CardTitle></CardHeader>
          <CardContent><AreaTrend data={o.scans_series} gradientId="ret-scans" color="#059669" height={240} /></CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Cohort retention</CardTitle>
          <CardDescription>Retention by signup month — arrives in v2 (needs more historical data).</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Placeholder. Lapse-risk buckets (day 30/45/55/59) and an at-risk member list are next; benefit-clock
          risk is already surfaced on the Summary “Needs attention” panel.
        </CardContent>
      </Card>
    </div>
  );
}
