"use client";

import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { rsd } from "@/lib/overview";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Scan = { d: string; t: string };
type Detail = {
  profile_id: string;
  email: string | null;
  display_name: string | null;
  roles: string[];
  blocked: boolean;
  account_timezone: string;
  joined: string;
  subscription: {
    status: string;
    refill_mode: string;
    cadence_days: number | null;
    ref_code: string | null;
    buyer_discount_pct: number | null;
    last_paid_order_at: string | null;
    benefit_clock_expires_at: string | null;
  } | null;
  progress: { cumulative_xp: number; current_level: number; current_streak: number; longest_streak: number } | null;
  supply: { activated_boxes: number; total_sachets: number; consumed: number; remaining: number };
  consumption: {
    first_scan: string | null;
    last_scan: string | null;
    active_days: number;
    per_day: number | null;
    per_day_lifetime: number | null;
    days_per_box_est: number | null;
    days_to_empty_est: number | null;
  };
  total_spent: number;
  levels: { ordinal: number; name: string; threshold_xp: number; reached: boolean; perks: string[] }[];
  scans: Scan[];
  boxes: { human_code: string; status: string; activated_at: string | null }[];
  orders: { amount: number; charge_status: string; paid_at: string | null; created_at: string }[];
  shipments: { status: string; tracking_ref: string | null; shipped_at: string | null; delivered_at: string | null; days_in_transit: number | null }[];
  referred_by: string | null;
  is_referrer: boolean;
  tickets: { subject: string | null; status: string; created_at: string }[];
};

export default function MemberDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("fn_admin_member_detail", { p_profile: params.id });
    if (error) setError(error.message);
    else setD(data as Detail);
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="text-sm text-destructive">⚠️ {error}</p>;
  if (!d) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const benefitDays = d.subscription?.benefit_clock_expires_at
    ? Math.max(0, Math.ceil((new Date(d.subscription.benefit_clock_expires_at).getTime() - Date.now()) / 86400000))
    : null;
  const active = d.shipments.find((s) => s.status !== "delivered");

  // Supply / adherence. "Not scanned" sachets become DEACTIVATED once benefits lapse
  // (benefit clock — ADR-0011); while benefits are live they are still scannable.
  const received = d.supply.total_sachets;
  const scanned = d.supply.consumed;
  const notScanned = d.supply.remaining;
  const adherence = received > 0 ? Math.round((scanned / received) * 100) : 0;
  const perBox = d.supply.activated_boxes > 0 ? (scanned / d.supply.activated_boxes).toFixed(1) : "—";
  const benefitsLapsed =
    (benefitDays != null && benefitDays <= 0) ||
    ["lapsed", "cancelled"].includes(d.subscription?.status ?? "") ||
    !d.subscription;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => router.push("/members")}>
        <ArrowLeft /> Members
      </Button>
      <PageHeader
        title={d.email ?? "Member"}
        subtitle={`${d.display_name ? d.display_name + " · " : ""}joined ${new Date(d.joined).toLocaleDateString("en-US")} · ${d.account_timezone}`}
        actions={
          <div className="flex gap-1">
            {d.roles.map((r) => (
              <Badge key={r} tone={r === "admin" ? "danger" : r === "member" ? "neutral" : "info"}>
                {r}
              </Badge>
            ))}
            {d.blocked && <Badge tone="danger">blocked</Badge>}
          </div>
        }
      />

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Level" value={d.progress?.current_level ?? 1} />
        <Kpi label="XP" value={d.progress?.cumulative_xp ?? 0} />
        <Kpi label="Streak" value={`${d.progress?.current_streak ?? 0}d`} sub={`best ${d.progress?.longest_streak ?? 0}d`} />
        <Kpi label="Adherence" value={`${adherence}%`} sub={`${scanned}/${received} scanned`} />
        <Kpi label="Lifetime spend" value={rsd(d.total_spent)} />
        <Kpi label="Days to empty" value={d.consumption.days_to_empty_est ?? "—"} sub={`${d.consumption.per_day ?? 0}/day now`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Subscription */}
        <Card>
          <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {d.subscription ? (
              <>
                <Line k="Status"><Badge tone={d.subscription.status === "active" ? "success" : d.subscription.status === "lapsed" || d.subscription.status === "cancelled" ? "danger" : "warning"}>{d.subscription.status}</Badge></Line>
                <Line k="Refill">{d.subscription.refill_mode}{d.subscription.cadence_days ? ` · ${d.subscription.cadence_days}d` : ""}</Line>
                <Line k="Benefit clock">{benefitDays != null ? `${benefitDays} days left` : "—"}</Line>
                <Line k="Last paid">{d.subscription.last_paid_order_at ? new Date(d.subscription.last_paid_order_at).toLocaleDateString("en-US") : "—"}</Line>
                <Line k="Referred by">{d.referred_by ?? "—"}</Line>
                {d.subscription.ref_code && <Line k="Ref code">{d.subscription.ref_code}</Line>}
              </>
            ) : (
              <p className="text-muted-foreground">No subscription (Prospect).</p>
            )}
          </CardContent>
        </Card>

        {/* Delivery */}
        <Card>
          <CardHeader><CardTitle>Delivery</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {active ? (
              <>
                <Line k="Status"><Badge tone="info">{active.status.replace("_", " ")}</Badge></Line>
                <Line k="Shipped">{active.shipped_at ? new Date(active.shipped_at).toLocaleDateString("en-US") : "—"}</Line>
                <Line k="In transit">{active.days_in_transit != null ? `${active.days_in_transit} days` : "—"}</Line>
                <Line k="Tracking">{active.tracking_ref ?? "—"}</Line>
              </>
            ) : (
              <p className="text-muted-foreground">No active shipment.</p>
            )}
            {d.shipments.length > 0 && (
              <p className="pt-2 text-xs text-muted-foreground">{d.shipments.length} shipment(s) total</p>
            )}
          </CardContent>
        </Card>

        {/* Consumption */}
        <Card>
          <CardHeader><CardTitle>Consumption</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Line k="Rate (last 28d)">{d.consumption.per_day ?? 0} /day</Line>
            <Line k="Avg while active">{d.consumption.per_day_lifetime ?? 0} /day</Line>
            <Line k="Time per box">{d.consumption.days_per_box_est ? `~${d.consumption.days_per_box_est} days` : "—"}</Line>
            <Line k="Active days">{d.consumption.active_days}</Line>
            <Line k="First scan">{d.consumption.first_scan ?? "—"}</Line>
            <Line k="Last scan">{d.consumption.last_scan ?? "—"}</Line>
            <div className="my-1 border-t border-border" />
            <Line k="Received">{received} sachets ({d.supply.activated_boxes} boxes)</Line>
            <Line k="Scanned">{scanned}</Line>
            <Line k="Not scanned">
              <span className="inline-flex items-center gap-2">
                {notScanned}
                {notScanned > 0 && (
                  <Badge tone={benefitsLapsed ? "warning" : "neutral"}>
                    {benefitsLapsed ? "aged" : "within window"}
                  </Badge>
                )}
              </span>
            </Line>
            <Line k="Avg / box">{perBox} sachets</Line>
          </CardContent>
        </Card>
      </div>

      {/* Consumption calendar */}
      <Card className="mt-6">
        <CardHeader><CardTitle>Consumption calendar</CardTitle></CardHeader>
        <CardContent>
          <MonthsCalendar scans={d.scans} />
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block size-3 rounded" style={{ background: "var(--primary)" }} />
            sachet consumed — the time is shown in the day; hover for details
          </p>
        </CardContent>
      </Card>

      {/* Levels + correction */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Levels &amp; perks</CardTitle></CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-y-auto">
            {d.levels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No levels configured.</p>
            ) : (
              d.levels.map((l) => (
                <div key={l.ordinal} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={l.reached ? "success" : "neutral"}>{l.reached ? "✓" : l.ordinal}</Badge>
                    <span className="font-medium">{l.name}</span>
                    <span className="tabular text-xs text-muted-foreground">{l.threshold_xp} XP</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{l.perks.length ? l.perks.join(", ") : "—"}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <CorrectionCard profileId={d.profile_id} onChanged={load} />
      </div>

      {/* Boxes + Orders + Tickets */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ListCard title="Boxes" items={d.boxes} row={(b, i) => twoCol(b.human_code, b.status, i)} />
        <ListCard title="Orders" items={d.orders} row={(o, i) => twoCol(rsd(o.amount), o.charge_status, i)} />
        <ListCard title="Support tickets" items={d.tickets} row={(t, i) => twoCol(t.subject ?? "—", t.status, i)} />
      </div>
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="tabular text-2xl font-semibold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Line({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function twoCol(a: string, b: string, key: React.Key) {
  return (
    <div key={key} className="flex justify-between border-b border-border py-1.5 last:border-0">
      <span className="tabular">{a}</span>
      <span className="text-muted-foreground">{b}</span>
    </div>
  );
}

// Compact list card: shows the first `limit` rows; "View all" opens the full scrollable list.
function ListCard<T>({
  title,
  items,
  row,
  limit = 5,
}: {
  title: string;
  items: T[];
  row: (item: T, i: number) => React.ReactNode;
  limit?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>
          {title}
          {items.length > 0 && <span className="ml-1 font-normal text-muted-foreground">({items.length})</span>}
        </CardTitle>
        {items.length > limit && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            View all
          </Button>
        )}
      </CardHeader>
      <CardContent className="text-sm">
        {items.length === 0 ? <p className="text-muted-foreground">None.</p> : items.slice(0, limit).map(row)}
      </CardContent>
      {open && (
        <Modal open onClose={() => setOpen(false)} title={title}>
          <div className="max-h-[60vh] overflow-y-auto text-sm">{items.map(row)}</div>
        </Modal>
      )}
    </Card>
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function MonthsCalendar({ scans }: { scans: Scan[] }) {
  const byDay = useMemo(() => new Map(scans.map((s) => [s.d, s.t])), [scans]);
  const [page, setPage] = useState(0); // 0 = latest 3 months; each step = 3 months
  const now = new Date();
  const anchor = new Date(now.getFullYear(), now.getMonth() + page * 3, 1); // rightmost month of the window
  const months = [-2, -1, 0].map((k) => new Date(anchor.getFullYear(), anchor.getMonth() + k, 1));
  const range = `${months[0]!.toLocaleDateString("en-US", { month: "short" })} – ${months[2]!.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" onClick={() => setPage((p) => p - 1)} aria-label="Earlier months">
          <ChevronLeft />
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{range}</span>
          {page !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setPage(0)}>
              Latest
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setPage((p) => Math.min(0, p + 1))}
          disabled={page >= 0}
          aria-label="Later months"
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {months.map((m) => (
          <MonthCalendar key={`${m.getFullYear()}-${m.getMonth()}`} month={m} byDay={byDay} />
        ))}
      </div>
    </div>
  );
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function MonthCalendar({ month, byDay, hideTitle }: { month: Date; byDay: Map<string, string>; hideTitle?: boolean }) {
  const y = month.getFullYear();
  const mo = month.getMonth();
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const lead = (new Date(y, mo, 1).getDay() + 6) % 7; // Monday-first leading blanks
  const todayKey = `${new Date().getFullYear()}-${pad2(new Date().getMonth() + 1)}-${pad2(new Date().getDate())}`;

  const cells: ({ day: number; key: string; time?: string } | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${y}-${pad2(mo + 1)}-${pad2(day)}`;
    cells.push({ day, key, time: byDay.get(key) });
  }

  return (
    <div>
      {!hideTitle && (
        <div className="mb-2 text-sm font-medium">
          {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </div>
      )}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
        {WEEKDAYS.map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) =>
          c === null ? (
            <div key={i} />
          ) : (
            <div
              key={i}
              title={c.time ? `${c.key} · ${fmtTime(c.time)}` : c.key}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded text-[11px] leading-none",
                c.time
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground",
                c.key === todayKey && !c.time && "ring-1 ring-primary",
              )}
            >
              <span>{c.day}</span>
              {c.time && <span className="mt-0.5 text-[8px] font-normal opacity-90">{fmtTime(c.time)}</span>}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function CorrectionCard({ profileId, onChanged }: { profileId: string; onChanged: () => void }) {
  const [xp, setXp] = useState("");
  const [streak, setStreak] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("fn_admin_adjust_progress", {
      p_profile: profileId,
      p_xp: xp === "" ? null : Number(xp),
      p_streak: streak === "" ? null : Number(streak),
      p_reason: reason,
    });
    setBusy(false);
    if (error) setMsg(`⚠️ ${error.message}`);
    else {
      setMsg("✓ Corrected.");
      setXp("");
      setStreak("");
      setReason("");
      onChanged();
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Correct XP / Streak (audited)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label>XP</Label><Input type="number" placeholder="unchanged" value={xp} onChange={(e) => setXp(e.target.value)} /></div>
          <div className="space-y-1"><Label>Streak</Label><Input type="number" placeholder="unchanged" value={streak} onChange={(e) => setStreak(e.target.value)} /></div>
        </div>
        <Input placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button size="sm" disabled={!reason.trim() || busy} onClick={apply}>
          {busy ? "Saving…" : "Apply correction"}
        </Button>
        {msg && <p className="text-xs">{msg}</p>}
      </CardContent>
    </Card>
  );
}
