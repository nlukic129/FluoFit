"use client";

import { Boxes, LifeBuoy, PackageX, Truck, UserPlus, Users } from "lucide-react";

import { useOverviewData } from "@/components/overview-filters";
import { Tile } from "@/components/overview-bits";
import { num } from "@/lib/overview";

export default function OperationsPage() {
  const { o, error } = useOverviewData();
  if (error) return <p className="text-sm text-destructive">⚠️ {error}</p>;
  if (!o) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      <Tile label="Boxes activated" value={`${num(o.ops.boxes_activated)}/${num(o.ops.boxes_total)}`} icon={Boxes} />
      <Tile label="Unbound boxes" value={num(o.ops.boxes_unbound)} icon={PackageX} />
      <Tile label="In transit" value={num(o.ops.shipments_in_transit)} icon={Truck} />
      <Tile label="Open tickets" value={num(o.ops.tickets_open)} icon={LifeBuoy} />
      <Tile label="Open waves" value={num(o.ops.waves_open)} icon={UserPlus} />
      <Tile label="Agents / Affiliates" value={`${o.referrers.agents} / ${o.referrers.affiliates}`} icon={Users} />
    </div>
  );
}
