"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { Select } from "@/components/ui/select";
import { PRESETS, computeRange, currentMonthKey, type Overview } from "@/lib/overview";
import { supabase } from "@/lib/supabase/client";

type Filters = { period: string; month: string; city: string; from: Date; to: Date; label: string };
const Ctx = createContext<Filters | null>(null);

export function useOverviewFilters(): Filters {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOverviewFilters must be used within OverviewFiltersProvider");
  return v;
}

// Shared fetch of the Overview aggregate for the current filters.
export function useOverviewData(): { o: Overview | null; error: string | null } {
  const { from, to, city } = useOverviewFilters();
  const [o, setO] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    supabase
      .rpc("fn_admin_overview", { p_from: from.toISOString(), p_to: to.toISOString(), p_city: city || null })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setO(data as Overview);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.getTime(), to.getTime(), city]);
  return { o, error };
}

// Held in the Overview layout, so filter state persists across the sub-tabs (a Next.js layout
// is not remounted when navigating between its child routes).
export function OverviewFiltersProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState("30d");
  const [month, setMonth] = useState(currentMonthKey());
  const [city, setCity] = useState("");
  const [cities, setCities] = useState<{ city: string; members: number }[]>([]);

  useEffect(() => {
    supabase.rpc("fn_admin_member_cities").then(({ data }) => {
      if (data) setCities(data as { city: string; members: number }[]);
    });
  }, []);

  const { from, to } = computeRange(period, month);
  const label =
    period === "custom"
      ? new Date(`${month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : (PRESETS.find((p) => p.key === period)?.label ?? "selected period");

  return (
    <Ctx.Provider value={{ period, month, city, from, to, label }}>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Select className="w-40" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </Select>
        {period === "custom" && (
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
        <Select className="w-44" value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c.city} value={c.city}>
              {c.city}
            </option>
          ))}
        </Select>
      </div>
      {children}
    </Ctx.Provider>
  );
}
