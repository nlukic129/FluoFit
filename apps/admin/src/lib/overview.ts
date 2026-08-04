// Shared helpers + types for the Overview dashboard sub-pages.

export const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_month", label: "This month" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "12m", label: "Last 12 months" },
  { key: "custom", label: "Specific month" },
] as const;

export function computeRange(period: string, month: string): { from: Date; to: Date } {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const back = (n: number) => {
    const f = new Date(now);
    f.setDate(f.getDate() - n);
    return { from: f, to: now };
  };
  switch (period) {
    case "today":
      return { from: startToday, to: now };
    case "yesterday": {
      const y = new Date(startToday);
      y.setDate(y.getDate() - 1);
      const e = new Date(startToday);
      e.setSeconds(-1);
      return { from: y, to: e };
    }
    case "this_month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    case "7d":
      return back(7);
    case "90d":
      return back(90);
    case "12m":
      return back(365);
    case "custom": {
      const [y, m] = month.split("-").map(Number);
      return { from: new Date(y!, (m ?? 1) - 1, 1), to: new Date(y!, m ?? 1, 0, 23, 59, 59) };
    }
    default:
      return back(30);
  }
}

export const currentMonthKey = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
};

export const rsd = (n: number) =>
  `${Number(n).toLocaleString("sr-RS", { maximumFractionDigits: 0 })} RSD`;
export const num = (n: number) => Number(n).toLocaleString("en-US");

export type Series = { d: string; v: number }[];

export type Overview = {
  kpis: {
    active_subs: number;
    lapsed: number;
    new_members: number;
    revenue_period: number;
    recurring_est: number;
    pending_payout: number;
    boxes_activated: number;
    open_tickets: number;
    arpu: number | null;
  };
  margin: {
    box_price: number;
    cogs_per_box: number;
    unit_margin: number;
    margin_pct: number;
    gross_margin_period: number;
    ltv_est: number;
  };
  members_by_status: Record<string, number>;
  members_by_city: { city: string; n: number }[];
  referrers: { agents: number; affiliates: number };
  top_referrers: {
    email: string;
    type: string;
    ref_code: string;
    status: string;
    active_subs: number;
    paid: number;
    pending: number;
    total: number;
  }[];
  commissions: { accrued: number; payable: number; paid: number };
  ops: {
    boxes_total: number;
    boxes_activated: number;
    boxes_unbound: number;
    tickets_open: number;
    waves_open: number;
    shipments_in_transit: number;
  };
  engagement: { avg_adherence: number; aged_sachets: number };
  revenue_series: Series;
  signups_series: Series;
  scans_series: Series;
};

export type Summary = {
  kpis: {
    active_members: number;
    revenue_period: number;
    new_members: number;
    lapsed_period: number;
    pending_payout: number;
    arpu: number | null;
  };
  kpis_prev: { revenue_period: number; new_members: number; lapsed_period: number };
  needs_attention: {
    lapse_risk: number;
    smart_pending: number;
    held_commissions_n: number;
    held_commissions_sum: number;
    expiring_stock: number;
    open_tickets: number;
  };
};
