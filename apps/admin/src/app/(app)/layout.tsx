import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth-guard";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="app-shell flex h-dvh overflow-hidden">
        <AppSidebar />
        <main className="app-main flex-1 overflow-y-auto">
          <div className="app-content mx-auto max-w-[1400px] p-8">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
