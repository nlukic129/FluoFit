"use client";

import { AlertTriangle, Boxes, Plus, Printer, Search, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { rsd } from "@/lib/overview";
import { supabase } from "@/lib/supabase/client";

type Lot = {
  id: string;
  name: string;
  unit_count: number;
  manufactured_on: string;
  expiry_date: string | null;
  cogs_per_unit: number | null;
  recalled_at: string | null;
  recall_reason: string | null;
  last_printed_at: string | null;
  print_count: number;
  created_at: string;
  total_boxes: number;
  activated: number;
  unbound: number;
  void: number;
  shipped: number;
  expiring_unbound: number;
  expired_unbound: number;
};

type RecallTarget = { human_code: string; display_name: string | null; email: string | null; activated_at: string };

const monthYear = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : "—";
const daysUntil = (d: string | null) => (d ? Math.round((new Date(d).getTime() - Date.now()) / 86_400_000) : null);

export default function ProvisioningPage() {
  const router = useRouter();
  const [lots, setLots] = useState<Lot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState("");

  // New-lot modal
  const [genOpen, setGenOpen] = useState(false);
  const [name, setName] = useState("");
  const [count, setCount] = useState("500");
  const [mfg, setMfg] = useState(() => new Date().toISOString().slice(0, 10));
  const [shelfMonths, setShelfMonths] = useState("18");
  const [cogs, setCogs] = useState("");

  // Void-unbound + Recall modals
  const [voidLot, setVoidLot] = useState<Lot | null>(null);
  const [recallLot, setRecallLot] = useState<Lot | null>(null);
  const [reason, setReason] = useState("");
  const [targets, setTargets] = useState<RecallTarget[] | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase.rpc("fn_admin_lot_funnel");
    if (error) setError(error.message);
    else setLots((data as Lot[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Suggest LOT-YYYY-MM-NNN when opening the new-lot modal.
  function openNewLot() {
    const n = new Date();
    const seq = String(lots.length + 1).padStart(3, "0");
    setName(`LOT-${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${seq}`);
    setCount("500");
    setMfg(n.toISOString().slice(0, 10));
    setShelfMonths("18");
    setCogs("");
    setGenOpen(true);
  }

  async function createLot() {
    setBusy(true);
    setError(null);
    const expiry = (() => {
      const d = new Date(mfg);
      d.setMonth(d.getMonth() + (Number(shelfMonths) || 0));
      return d.toISOString().slice(0, 10);
    })();
    const { error: e } = await supabase.rpc("fn_provision_batch", {
      p_name: name,
      p_count: Number(count),
      p_manufactured_on: mfg,
      p_expiry_date: expiry,
      p_cogs: cogs ? Number(cogs) : null,
    });
    setBusy(false);
    if (e) setError(e.message);
    else {
      setGenOpen(false);
      await load();
    }
  }

  async function confirmVoidLot() {
    if (!voidLot) return;
    setBusy(true);
    const { error: e } = await supabase.rpc("fn_void_lot_unbound", { p_batch_id: voidLot.id, p_reason: reason });
    setBusy(false);
    if (e) setError(e.message);
    else {
      setVoidLot(null);
      setReason("");
      await load();
    }
  }

  async function confirmRecall() {
    if (!recallLot) return;
    setBusy(true);
    const { error: e } = await supabase.rpc("fn_recall_lot", { p_batch_id: recallLot.id, p_reason: reason });
    if (e) {
      setBusy(false);
      setError(e.message);
      return;
    }
    const { data } = await supabase.rpc("fn_lot_recall_targets", { p_batch_id: recallLot.id });
    setBusy(false);
    setTargets((data as RecallTarget[]) ?? []);
    setRecallLot(null);
    setReason("");
    await load();
  }

  const totalExpiring = lots.reduce((a, l) => a + Number(l.expiring_unbound), 0);

  return (
    <>
      <PageHeader
        title="Provisioning"
        subtitle="Manufacturing lots, Box lifecycle, and label printing."
        actions={
          <Button onClick={openNewLot}>
            <Plus /> New lot
          </Button>
        }
      />

      {/* Lookup by code — support / fraud / recall */}
      <form
        className="mb-6 flex max-w-md items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (lookup.trim()) router.push(`/provisioning/box/${encodeURIComponent(lookup.trim())}`);
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Look up a Box by code (scan or paste)…"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" disabled={!lookup.trim()}>
          Find
        </Button>
      </form>

      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      {totalExpiring > 0 && (
        <Link
          href="/provisioning/boxes?flag=expiring"
          className="mb-6 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 transition-colors hover:border-amber-400"
        >
          <AlertTriangle className="size-4 text-amber-500" />
          <span>
            <span className="font-medium">{totalExpiring}</span> expiring boxes — still unbound, lot expires within 90
            days. Sell/ship or write off.
          </span>
        </Link>
      )}

      <div className="space-y-4">
        {lots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lots yet — create one to start.</p>
        ) : (
          lots.map((l) => <LotCard key={l.id} lot={l} onVoid={() => setVoidLot(l)} onRecall={() => setRecallLot(l)} onTargets={async () => {
            const { data } = await supabase.rpc("fn_lot_recall_targets", { p_batch_id: l.id });
            setTargets((data as RecallTarget[]) ?? []);
          }} />)
        )}
      </div>

      {/* New lot */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="New manufacturing lot">
        <div className="space-y-1.5">
          <Label htmlFor="lot-name">Lot name</Label>
          <Input id="lot-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="lot-count">Usable boxes</Label>
            <Input id="lot-count" type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lot-cogs">COGS / box (RSD)</Label>
            <Input id="lot-cogs" type="number" min={0} placeholder="dial default" value={cogs} onChange={(e) => setCogs(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lot-mfg">Manufactured on</Label>
            <Input id="lot-mfg" type="date" value={mfg} onChange={(e) => setMfg(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lot-shelf">Shelf life (months)</Label>
            <Input id="lot-shelf" type="number" min={1} value={shelfMonths} onChange={(e) => setShelfMonths(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Expiry auto-computes to{" "}
          <span className="font-medium text-foreground">
            {(() => {
              const d = new Date(mfg);
              d.setMonth(d.getMonth() + (Number(shelfMonths) || 0));
              return d.toLocaleDateString("en-US");
            })()}
          </span>
          . Generates {Number(count) || 0} opaque Box codes.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => setGenOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!name || !(Number(count) > 0) || busy} onClick={createLot}>
            {busy ? "Generating…" : "Generate lot"}
          </Button>
        </div>
      </Modal>

      {/* Void unbound */}
      <Modal open={voidLot !== null} onClose={() => setVoidLot(null)} title="Void all unbound boxes in lot">
        <p className="text-sm text-muted-foreground">
          This voids the <span className="font-medium text-foreground">{voidLot?.unbound}</span> still-unbound boxes in{" "}
          <span className="font-medium text-foreground">{voidLot?.name}</span>. Activated boxes are never touched. A
          reason is required (audited).
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="void-reason">Reason</Label>
          <Input id="void-reason" placeholder="water damage in warehouse" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => setVoidLot(null)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!reason.trim() || busy} onClick={confirmVoidLot}>
            {busy ? "Voiding…" : `Void ${voidLot?.unbound ?? 0} boxes`}
          </Button>
        </div>
      </Modal>

      {/* Recall */}
      <Modal open={recallLot !== null} onClose={() => setRecallLot(null)} title="Recall lot">
        <p className="text-sm text-muted-foreground">
          Flags <span className="font-medium text-foreground">{recallLot?.name}</span> as recalled. Future activation of
          its unbound boxes is blocked; already-activated boxes stay activated (historical truth). You&apos;ll get the list
          of <span className="font-medium text-foreground">{recallLot?.activated}</span> members holding a box to notify.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="recall-reason">Reason</Label>
          <Input id="recall-reason" placeholder="ingredient quality issue" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => setRecallLot(null)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!reason.trim() || busy} onClick={confirmRecall}>
            {busy ? "Recalling…" : "Recall lot"}
          </Button>
        </div>
      </Modal>

      {/* Recall targets (notify list) */}
      <Modal open={targets !== null} onClose={() => setTargets(null)} title={`Members to notify (${targets?.length ?? 0})`}>
        {targets && targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activated boxes from this lot are in members&apos; hands.</p>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto text-sm">
            {targets?.map((t) => (
              <div key={t.human_code} className="flex items-center justify-between rounded border border-border px-2.5 py-1.5">
                <div>
                  <div className="font-medium">{t.display_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{t.email ?? "—"}</div>
                </div>
                <div className="text-right">
                  <div className="tabular text-xs">{t.human_code}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.activated_at).toLocaleDateString("en-US")}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={() => setTargets(null)}>
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
}

function LotCard({
  lot,
  onVoid,
  onRecall,
  onTargets,
}: {
  lot: Lot;
  onVoid: () => void;
  onRecall: () => void;
  onTargets: () => void;
}) {
  const router = useRouter();
  const total = Math.max(1, Number(lot.total_boxes));
  const seg = (n: number) => `${(Number(n) / total) * 100}%`;
  const exp = daysUntil(lot.expiry_date);
  const expSoon = exp != null && exp < 90;
  const expired = exp != null && exp < 0;

  return (
    <Card className={lot.recalled_at ? "border-red-300" : undefined}>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{lot.name}</span>
              {lot.recalled_at && <Badge tone="danger">Recalled</Badge>}
              {!lot.recalled_at && expired && <Badge tone="danger">Expired</Badge>}
              {!lot.recalled_at && !expired && expSoon && <Badge tone="warning">Expires soon</Badge>}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {lot.total_boxes} usable · mfg {monthYear(lot.manufactured_on)} · exp {monthYear(lot.expiry_date)}
              {lot.cogs_per_unit != null && <> · COGS {rsd(lot.cogs_per_unit)}</>}
              {" · "}
              {lot.print_count > 0 ? `printed ${lot.print_count}×` : "not printed"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => router.push(`/provisioning/print?batch=${lot.id}`)}>
              <Printer /> Print labels
            </Button>
            <Button size="sm" variant="outline" onClick={() => router.push(`/provisioning/boxes?lot=${lot.id}`)}>
              <Boxes /> View boxes
            </Button>
            {lot.unbound > 0 && (
              <Button size="sm" variant="outline" onClick={onVoid}>
                <Trash2 /> Void unbound
              </Button>
            )}
            {!lot.recalled_at ? (
              <Button size="sm" variant="destructive" onClick={onRecall}>
                <Undo2 /> Recall
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onTargets}>
                View affected
              </Button>
            )}
          </div>
        </div>

        {lot.recalled_at && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            Recalled {new Date(lot.recalled_at).toLocaleDateString("en-US")} — {lot.recall_reason}
          </p>
        )}

        {/* Funnel bar: activated | unbound | void (sums to total) */}
        <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="bg-emerald-500" style={{ width: seg(lot.activated) }} title={`${lot.activated} activated`} />
          <div className="bg-blue-400" style={{ width: seg(lot.unbound) }} title={`${lot.unbound} unbound`} />
          <div className="bg-red-400" style={{ width: seg(lot.void) }} title={`${lot.void} void`} />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <Legend color="bg-emerald-500" label="activated" value={lot.activated} />
          <Legend color="bg-blue-400" label="unbound" value={lot.unbound} />
          <Legend color="bg-red-400" label="void" value={lot.void} />
          <span className="mx-1 h-3 w-px bg-border" />
          <span className="text-muted-foreground">🚚 {lot.shipped} shipped</span>
          {lot.expiring_unbound > 0 && (
            <Link href={`/provisioning/boxes?lot=${lot.id}&flag=expiring`} className="text-amber-700 hover:underline">
              ⏳ {lot.expiring_unbound} expiring
            </Link>
          )}
          {lot.expired_unbound > 0 && <span className="text-red-700">⌛ {lot.expired_unbound} expired</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className={`size-2 rounded-full ${color}`} />
      <span className="tabular font-medium text-foreground">{value}</span> {label}
    </span>
  );
}
