import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Placeholder for modules not yet built (M2+). Keeps the sidebar navigable without 404s.
export function ComingSoon({ module, note }: { module: string; note?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{module} — coming soon</CardTitle>
        <CardDescription>
          {note ?? "This module is planned in the Admin completion track (see docs/ROADMAP.md)."}
        </CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
