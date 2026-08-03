"use client";

import { UserPlus, Users } from "lucide-react";

import { AreaTrend, CityBars, StatusDonut } from "@/components/charts";
import { useOverviewData } from "@/components/overview-filters";
import { SectionTitle, Tile } from "@/components/overview-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num } from "@/lib/overview";

export default function GrowthPage() {
  const { o, error } = useOverviewData();
  if (error) return <p className="text-sm text-destructive">⚠️ {error}</p>;
  if (!o) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="Active subs" value={num(o.kpis.active_subs)} icon={Users} />
        <Tile label="New members" value={num(o.kpis.new_members)} icon={UserPlus} />
        <Tile label="Agents" value={num(o.referrers.agents)} icon={Users} />
        <Tile label="Affiliates" value={num(o.referrers.affiliates)} icon={Users} />
      </div>

      <section>
        <SectionTitle>Members</SectionTitle>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>By status</CardTitle></CardHeader>
            <CardContent>
              <StatusDonut
                data={[
                  { name: "active", value: o.members_by_status.active ?? 0, color: "#059669" },
                  { name: "paused", value: o.members_by_status.paused ?? 0, color: "#D97706" },
                  { name: "lapsed", value: o.members_by_status.lapsed ?? 0, color: "#DC2626" },
                  { name: "cancelled", value: o.members_by_status.cancelled ?? 0, color: "#94a3b8" },
                  { name: "prospect", value: o.members_by_status.prospect ?? 0, color: "#3B82F6" },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>New members</CardTitle></CardHeader>
            <CardContent><AreaTrend data={o.signups_series} gradientId="g-signup" color="#3B82F6" /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>By city</CardTitle></CardHeader>
            <CardContent><CityBars data={o.members_by_city} /></CardContent>
          </Card>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Channel breakdown (Agent / Affiliate / Direct / Retail) and Prospect→Member conversion land next — see roadmap.
      </p>
    </div>
  );
}
