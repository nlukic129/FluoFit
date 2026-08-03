import type { ReactNode } from "react";

import { OverviewFiltersProvider } from "@/components/overview-filters";
import { PageHeader } from "@/components/page-shell";

export default function OverviewLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Overview" subtitle="Financial and member health across the platform." />
      <OverviewFiltersProvider>{children}</OverviewFiltersProvider>
    </>
  );
}
