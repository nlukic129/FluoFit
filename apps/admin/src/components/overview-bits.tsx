import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{children}</h2>;
}

export function Tile({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon?: LucideIcon }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          {Icon && <Icon className="size-4 text-muted-foreground" />}
        </div>
        <div className="tabular mt-1 text-2xl font-semibold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// KPI tile with a Δ vs previous period. `delta` is percent change (null = no baseline).
// `goodWhenUp` flips color meaning for metrics where a drop is good (e.g. lapses).
export function DeltaKpi({
  label,
  value,
  delta,
  goodWhenUp = true,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta: number | null;
  goodWhenUp?: boolean;
  icon?: LucideIcon;
}) {
  const up = (delta ?? 0) >= 0;
  const good = up === goodWhenUp;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          {Icon && <Icon className="size-4 text-muted-foreground" />}
        </div>
        <div className="tabular mt-1 text-2xl font-semibold">{value}</div>
        {delta === null ? (
          <div className="text-xs text-muted-foreground">no prior period</div>
        ) : (
          <div className={cn("flex items-center gap-1 text-xs font-medium", good ? "text-emerald-600" : "text-destructive")}>
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta)}% vs prev
          </div>
        )}
      </CardContent>
    </Card>
  );
}
