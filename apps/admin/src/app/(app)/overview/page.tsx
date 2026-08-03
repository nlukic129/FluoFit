import { Boxes, LifeBuoy, Users, Wallet } from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// KPIs are static placeholders in M0; live counts get wired with the data layer in M1.
const KPIS = [
  { label: "Active subscriptions", value: "—", icon: Users },
  { label: "Boxes activated", value: "—", icon: Boxes },
  { label: "Pending payout", value: "—", icon: Wallet },
  { label: "Open tickets", value: "—", icon: LifeBuoy },
];

export default function OverviewPage() {
  return (
    <>
      <PageHeader title="Overview" subtitle="Operational snapshot of the FluoFit platform." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map(({ label, value, icon: Icon }) => (
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
