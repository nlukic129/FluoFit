"use client";

import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Plus } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { AddressAutocomplete, type PickedAddress } from "@/components/address-autocomplete";
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
  orders: { id: string; amount: number; charge_status: string; paid_at: string | null; created_at: string }[];
  shipments: { status: string; tracking_ref: string | null; shipped_at: string | null; delivered_at: string | null; days_in_transit: number | null }[];
  referred_by: string | null;
  is_referrer: boolean;
  tickets: { id: string; subject: string | null; status: string; created_at: string }[];
};

type TimelineEvent = { at: string; kind: string; title: string; detail: string | null };
type Note = { id: string; body: string; author_email: string | null; created_at: string };
type ReferrerInfo = { kind: string; status: string; ref_code: string; fixed_pct: number | null; current_tier: number | null; active_subs: number };

// A single reusable action: optional reason + optional extra text inputs, runs an RPC.
type ActionSpec = {
  title: string;
  desc?: string;
  confirmLabel: string;
  destructive?: boolean;
  reason?: boolean;
  extra?: { key: string; label: string; placeholder?: string }[];
  run: (v: { reason: string; extra: Record<string, string> }) => Promise<{ error: { message: string } | null }>;
};

export default function MemberDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [referrer, setReferrer] = useState<ReferrerInfo | null>(null);
  const [action, setAction] = useState<ActionSpec | null>(null);
  const [addrOpen, setAddrOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = params.id;
    const [det, tl, no, rf] = await Promise.all([
      supabase.rpc("fn_admin_member_detail", { p_profile: id }),
      supabase.rpc("fn_admin_member_timeline", { p_profile: id, p_limit: 60 }),
      supabase.rpc("fn_admin_list_notes", { p_profile: id }),
      supabase.rpc("fn_admin_member_referrer", { p_profile: id }),
    ]);
    if (det.error) {
      setError(det.error.message);
      return;
    }
    setD(det.data as Detail);
    setTimeline((tl.data as TimelineEvent[]) ?? []);
    setNotes((no.data as Note[]) ?? []);
    const rfArr = (rf.data as ReferrerInfo[]) ?? [];
    setReferrer(rfArr.length ? rfArr[0]! : null);
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

  // ── Action specs (all reason-gated + audited server-side) ──
  const pid = d.profile_id;
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(fn, args);
    return { error };
  };
  const blockSpec: ActionSpec = { title: "Block member", desc: "Bars this account from the Agent program and flags it.", confirmLabel: "Block", destructive: true, reason: true, run: ({ reason }) => rpc("fn_block_member", { p_profile: pid, p_reason: reason }) };
  const unblockSpec: ActionSpec = { title: "Unblock member", confirmLabel: "Unblock", reason: true, run: ({ reason }) => rpc("fn_unblock_member", { p_profile: pid, p_reason: reason }) };
  const resendSpec: ActionSpec = { title: "Resend login link", desc: "Sends a fresh passwordless login link (simulated — NotifyPort).", confirmLabel: "Send link", run: ({ reason }) => rpc("fn_admin_resend_login", { p_profile: pid, p_reason: reason || null }) };
  const cancelSpec: ActionSpec = { title: "Cancel subscription", desc: "Sets the subscription to cancelled. Does not touch the benefit clock.", confirmLabel: "Cancel subscription", destructive: true, reason: true, run: ({ reason }) => rpc("fn_admin_set_sub_status", { p_profile: pid, p_status: "cancelled", p_reason: reason }) };
  const pauseSpec: ActionSpec = { title: "Pause subscription", confirmLabel: "Pause", reason: true, run: ({ reason }) => rpc("fn_admin_set_sub_status", { p_profile: pid, p_status: "paused", p_reason: reason }) };
  const resumeSpec: ActionSpec = { title: "Resume subscription", confirmLabel: "Resume", reason: true, run: ({ reason }) => rpc("fn_admin_set_sub_status", { p_profile: pid, p_status: "active", p_reason: reason }) };
  const fixAttrSpec: ActionSpec = { title: "Fix referral attribution", desc: "Re-point this member's subscription to the referrer that owns the ref code.", confirmLabel: "Set attribution", reason: true, extra: [{ key: "code", label: "Ref code", placeholder: "REF-XXXX / AG-XXXX" }], run: ({ reason, extra }) => rpc("fn_admin_set_attribution", { p_profile: pid, p_ref_code: extra.code, p_reason: reason }) };
  const manualActivateSpec: ActionSpec = { title: "Manually activate a box", desc: "Activate a Box on this member's behalf (e.g. their QR won't scan).", confirmLabel: "Activate", reason: true, extra: [{ key: "code", label: "Box code", placeholder: "human code under the seal" }], run: ({ reason, extra }) => rpc("fn_admin_manual_activate", { p_code: extra.code, p_profile: pid, p_reason: reason }) };
  const refundSpec = (orderId: string): ActionSpec => ({ title: "Refund order", desc: "Marks the captured order refunded (simulated — PaymentPort).", confirmLabel: "Refund", destructive: true, reason: true, run: ({ reason }) => rpc("fn_admin_refund_order", { p_order: orderId, p_reason: reason }) });
  const subActive = d.subscription && d.subscription.status !== "cancelled";

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => router.push("/members")}>
        <ArrowLeft /> Members
      </Button>
      <PageHeader
        title={d.email ?? "Member"}
        subtitle={`${d.display_name ? d.display_name + " · " : ""}joined ${new Date(d.joined).toLocaleDateString("en-US")} · ${d.account_timezone}`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {d.roles.map((r) => (
                <Badge key={r} tone={r === "admin" ? "danger" : r === "member" ? "neutral" : "info"}>
                  {r}
                </Badge>
              ))}
              {d.blocked && <Badge tone="danger">blocked</Badge>}
            </div>
            <ActionsMenu
              items={[
                d.blocked
                  ? { label: "Unblock member", onClick: () => setAction(unblockSpec) }
                  : { label: "Block member", destructive: true, onClick: () => setAction(blockSpec) },
                { label: "Edit delivery address", onClick: () => setAddrOpen(true) },
                ...(subActive ? [{ label: "Cancel subscription", destructive: true, onClick: () => setAction(cancelSpec) }] : []),
              ]}
            />
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
                <div className="flex flex-wrap gap-2 pt-2">
                  {d.subscription.status === "paused" ? (
                    <Button size="sm" variant="outline" onClick={() => setAction(resumeSpec)}>Resume</Button>
                  ) : (
                    d.subscription.status !== "cancelled" && (
                      <Button size="sm" variant="outline" onClick={() => setAction(pauseSpec)}>Pause</Button>
                    )
                  )}
                  <Button size="sm" variant="outline" onClick={() => setAction(fixAttrSpec)}>Fix attribution</Button>
                </div>
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
        <ListCard
          title="Boxes"
          items={d.boxes}
          action={
            <Button size="sm" variant="ghost" onClick={() => setAction(manualActivateSpec)}>
              <Plus /> Activate
            </Button>
          }
          row={(b, i) => (
            <Link
              key={i}
              href={`/provisioning/box/${encodeURIComponent(b.human_code)}`}
              className="-mx-2 flex justify-between rounded px-2 py-1.5 hover:bg-muted"
            >
              <span className="tabular font-medium">{b.human_code}</span>
              <span className="text-muted-foreground">{b.status}</span>
            </Link>
          )}
        />
        <ListCard
          title="Orders"
          items={d.orders}
          row={(o, i) => (
            <div key={i} className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
              <span className="tabular">{rsd(o.amount)}</span>
              <span className="flex items-center gap-2">
                <Badge tone={o.charge_status === "captured" ? "success" : o.charge_status === "refunded" ? "warning" : "neutral"}>
                  {o.charge_status}
                </Badge>
                {o.charge_status === "captured" && (
                  <button className="text-xs font-medium text-primary hover:underline" onClick={() => setAction(refundSpec(o.id))}>
                    Refund
                  </button>
                )}
              </span>
            </div>
          )}
        />
        <ListCard
          title="Support tickets"
          items={d.tickets}
          row={(t, i) => (
            <Link
              key={i}
              href={`/support?focus=${t.id}`}
              className="-mx-2 flex justify-between gap-2 rounded px-2 py-1.5 hover:bg-muted"
            >
              <span className="truncate">{t.subject ?? "—"}</span>
              <span className="shrink-0 text-muted-foreground">{t.status}</span>
            </Link>
          )}
        />
      </div>

      {/* Referrer link-out */}
      {referrer && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <Badge tone="info">{referrer.kind}</Badge>
          <span className="text-muted-foreground">
            This member is also a referrer — code <span className="tabular font-medium text-foreground">{referrer.ref_code}</span> ·{" "}
            {referrer.active_subs} active referred subs · status {referrer.status}
          </span>
          <Link href="/referrers" className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Open in Referrers <ExternalLink className="size-3.5" />
          </Link>
        </div>
      )}

      {/* Notes */}
      <div className="mt-6">
        <NotesCard profileId={d.profile_id} notes={notes} onChanged={load} />
      </div>

      {/* Activity timeline */}
      <Card className="mt-6">
        <CardHeader><CardTitle>Activity timeline</CardTitle></CardHeader>
        <CardContent>
          <Timeline events={timeline} />
        </CardContent>
      </Card>

      {action && <ActionRunner spec={action} onClose={() => setAction(null)} onDone={load} />}
      {addrOpen && <AddressModal profileId={d.profile_id} onClose={() => setAddrOpen(false)} onDone={load} />}
    </>
  );
}

function AddressModal({ profileId, onClose, onDone }: { profileId: string; onClose: () => void; onDone: () => void }) {
  const [picked, setPicked] = useState<PickedAddress | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!picked) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("fn_admin_set_member_address", {
      p_profile: profileId,
      p_line1: picked.line1,
      p_city: picked.city,
      p_municipality: picked.municipality,
      p_postal: picked.postal,
      p_country: picked.country,
      p_place_id: picked.place_id,
      p_lat: picked.lat,
      p_lng: picked.lng,
      p_reason: reason,
    });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      onDone();
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit delivery address">
      <p className="text-sm text-muted-foreground">
        Search with Google Places — city, municipality (opština) and coordinates fill in automatically.
      </p>
      <AddressAutocomplete onPick={setPicked} />
      {picked && (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
          <div className="font-medium text-foreground">{picked.line1 || "—"}</div>
          <div className="text-muted-foreground">
            {picked.municipality ?? "—"} · {picked.city ?? "—"} · {picked.postal ?? ""}{" "}
            {picked.lat != null && `· ${picked.lat.toFixed(4)}, ${picked.lng?.toFixed(4)}`}
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Reason (required — audited)</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {err && <p className="text-sm text-destructive">⚠️ {err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!picked || !reason.trim() || busy} onClick={save}>
          {busy ? "Saving…" : "Save address"}
        </Button>
      </div>
    </Modal>
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

// Compact list card: shows the first `limit` rows; "View all" opens the full scrollable list.
function ListCard<T>({
  title,
  items,
  row,
  limit = 5,
  action,
}: {
  title: string;
  items: T[];
  row: (item: T, i: number) => React.ReactNode;
  limit?: number;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>
          {title}
          {items.length > 0 && <span className="ml-1 font-normal text-muted-foreground">({items.length})</span>}
        </CardTitle>
        <div className="flex items-center gap-1">
          {action}
          {items.length > limit && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              View all
            </Button>
          )}
        </div>
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

// Header dropdown for account-level actions.
function ActionsMenu({ items }: { items: { label: string; onClick: () => void; destructive?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
        Actions <ChevronDown />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-border bg-card p-1 shadow-md">
            {items.map((it) => (
              <button
                key={it.label}
                className={cn(
                  "block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                  it.destructive && "text-destructive",
                )}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
              >
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Runs one ActionSpec: renders reason + extra inputs, calls the RPC, reloads on success.
function ActionRunner({ spec, onClose, onDone }: { spec: ActionSpec; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const extraOk = (spec.extra ?? []).every((f) => (extra[f.key] ?? "").trim());
  const canRun = (!spec.reason || reason.trim()) && extraOk;

  async function go() {
    setBusy(true);
    setErr(null);
    const { error } = await spec.run({ reason, extra });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      onDone();
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title={spec.title}>
      {spec.desc && <p className="text-sm text-muted-foreground">{spec.desc}</p>}
      {(spec.extra ?? []).map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label>{f.label}</Label>
          <Input placeholder={f.placeholder} value={extra[f.key] ?? ""} onChange={(e) => setExtra((s) => ({ ...s, [f.key]: e.target.value }))} />
        </div>
      ))}
      {spec.reason && (
        <div className="space-y-1.5">
          <Label>Reason (required — audited)</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}
      {err && <p className="text-sm text-destructive">⚠️ {err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant={spec.destructive ? "destructive" : "default"} disabled={!canRun || busy} onClick={go}>
          {busy ? "Working…" : spec.confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

function NotesCard({ profileId, notes, onChanged }: { profileId: string; notes: Note[]; onChanged: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    const { error } = await supabase.rpc("fn_admin_add_note", { p_profile: profileId, p_body: body });
    setBusy(false);
    if (!error) {
      setBody("");
      onChanged();
    }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Internal notes</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Add a note (e.g. called re delivery, promised reship)…" value={body} onChange={(e) => setBody(e.target.value)} />
          <Button size="sm" disabled={!body.trim() || busy} onClick={add}>Add</Button>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="rounded-md border border-border px-3 py-2 text-sm">
                <div>{n.body}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {n.author_email ?? "admin"} · {new Date(n.created_at).toLocaleString("en-US")}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const TIMELINE_TONE: Record<string, string> = {
  signup: "bg-blue-400",
  order: "bg-indigo-400",
  payment: "bg-emerald-500",
  shipment: "bg-sky-400",
  ticket: "bg-amber-400",
  note: "bg-slate-400",
  admin: "bg-red-400",
};

const TIMELINE_PREVIEW = 8;

function Timeline({ events }: { events: TimelineEvent[] }) {
  const [all, setAll] = useState(false);
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  const shown = all ? events : events.slice(0, TIMELINE_PREVIEW);
  return (
    <div>
      <div className={cn("space-y-0", all && "max-h-96 overflow-y-auto pr-1")}>
        {shown.map((e, i) => (
          <div key={i} className="flex gap-3 border-b border-border py-2 last:border-0">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TIMELINE_TONE[e.kind] ?? "bg-muted")} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{e.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(e.at).toLocaleString("en-US")}</span>
              </div>
              {e.detail && <div className="truncate text-xs text-muted-foreground">{e.detail}</div>}
            </div>
          </div>
        ))}
      </div>
      {events.length > TIMELINE_PREVIEW && (
        <div className="pt-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => setAll((a) => !a)}>
            {all ? "Show less" : `Show all ${events.length}`}
          </Button>
        </div>
      )}
    </div>
  );
}
