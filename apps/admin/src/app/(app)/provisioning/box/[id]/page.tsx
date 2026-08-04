"use client";

import { ArrowLeft, Copy, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { rsd } from "@/lib/overview";
import { supabase } from "@/lib/supabase/client";

type BoxDetail = {
  id: string;
  human_code: string;
  opaque_token: string;
  status: "unbound" | "activated" | "void";
  created_at: string;
  subscription_id: string | null;
  lot: {
    id: string;
    name: string;
    manufactured_on: string;
    expiry_date: string | null;
    recalled_at: string | null;
    recall_reason: string | null;
    expired: boolean;
  };
  activation: { activated_at: string; member_id: string; member_name: string | null; member_email: string | null } | null;
  void: { reason: string } | null;
  fulfillment: {
    order_id: string;
    amount: number;
    charge_status: string;
    paid_at: string | null;
    shipment_status: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    tracking_ref: string | null;
  } | null;
};

const date = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-US") : "—");
const statusTone = (s: string) => (s === "activated" ? "success" : s === "void" ? "danger" : "info");

export default function BoxDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const code = decodeURIComponent(params.id);

  const [box, setBox] = useState<BoxDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("fn_admin_box_detail", { p_code: code });
    setLoading(false);
    if (error) setError(error.message);
    else if (!data) setNotFound(true);
    else setBox(data as BoxDetail);
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmVoid() {
    if (!box) return;
    setBusy(true);
    const { error: e } = await supabase.rpc("fn_void_box", { p_box_id: box.id, p_reason: reason });
    setBusy(false);
    if (e) setError(e.message);
    else {
      setVoidOpen(false);
      setReason("");
      await load();
    }
  }

  function copy() {
    if (!box) return;
    void navigator.clipboard.writeText(box.human_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.push("/provisioning")}>
        <ArrowLeft /> Provisioning
      </Button>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">⚠️ {error}</p>}
      {notFound && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No Box matches <span className="tabular font-medium text-foreground">{code}</span>. Check the code under the
            tamper seal and try again.
          </CardContent>
        </Card>
      )}

      {box && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Identity + QR */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center rounded-lg border border-border bg-white p-4">
                <QRCodeSVG value={box.opaque_token} size={160} level="M" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Human code</div>
                  <div className="tabular text-lg font-semibold">{box.human_code}</div>
                </div>
                <Button size="sm" variant="outline" onClick={copy}>
                  <Copy /> {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <Badge tone={statusTone(box.status)}>{box.status}</Badge>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => router.push(`/provisioning/print?batch=${box.lot.id}`)}>
                  <Printer /> Reprint (lot)
                </Button>
                {box.status === "unbound" && (
                  <Button size="sm" variant="destructive" onClick={() => setVoidOpen(true)}>
                    <Trash2 /> Void
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lifecycle */}
          <div className="space-y-6 lg:col-span-2">
            {(box.lot.recalled_at || box.lot.expired) && (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {box.lot.recalled_at
                  ? `This lot was recalled on ${date(box.lot.recalled_at)} — ${box.lot.recall_reason}`
                  : `This lot expired on ${date(box.lot.expiry_date)} — unbound boxes can no longer be activated.`}
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Lot</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <Row k="Lot">
                    <Link href={`/provisioning/boxes?lot=${box.lot.id}`} className="font-medium hover:underline">
                      {box.lot.name}
                    </Link>
                  </Row>
                  <Row k="Manufactured">{date(box.lot.manufactured_on)}</Row>
                  <Row k="Expiry">
                    <span className={box.lot.expired ? "font-medium text-red-600" : undefined}>
                      {date(box.lot.expiry_date)}
                    </span>
                  </Row>
                  <Row k="Generated">{date(box.created_at)}</Row>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>State</CardTitle>
              </CardHeader>
              <CardContent>
                {box.status === "activated" && box.activation ? (
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <Row k="Activated by">
                      <Link href={`/members/${box.activation.member_id}`} className="font-medium hover:underline">
                        {box.activation.member_name ?? "—"}
                      </Link>
                    </Row>
                    <Row k="Email">{box.activation.member_email ?? "—"}</Row>
                    <Row k="Activated on">{date(box.activation.activated_at)}</Row>
                    <Row k="Type">{box.subscription_id ? "Subscription box" : "Standalone box"}</Row>
                  </dl>
                ) : box.status === "void" && box.void ? (
                  <p className="text-sm text-muted-foreground">
                    Voided — <span className="text-foreground">{box.void.reason}</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Unbound — not yet activated by anyone.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fulfillment</CardTitle>
              </CardHeader>
              <CardContent>
                {box.fulfillment ? (
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <Row k="Order amount">{rsd(box.fulfillment.amount)}</Row>
                    <Row k="Charge">
                      <Badge tone={box.fulfillment.charge_status === "captured" ? "success" : "warning"}>
                        {box.fulfillment.charge_status}
                      </Badge>
                    </Row>
                    <Row k="Shipment">
                      {box.fulfillment.shipment_status ? (
                        <Badge tone={box.fulfillment.shipment_status === "delivered" ? "success" : "info"}>
                          {box.fulfillment.shipment_status}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </Row>
                    <Row k="Tracking">{box.fulfillment.tracking_ref ?? "—"}</Row>
                    <Row k="Shipped">{date(box.fulfillment.shipped_at)}</Row>
                    <Row k="Delivered">{date(box.fulfillment.delivered_at)}</Row>
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">No order references this box (not yet allocated).</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Modal open={voidOpen} onClose={() => setVoidOpen(false)} title="Void box">
        <p className="text-sm text-muted-foreground">
          Voiding <span className="tabular font-medium text-foreground">{box?.human_code}</span> permanently prevents
          activation. A reason is required (audited).
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="void-reason">Reason</Label>
          <Input id="void-reason" placeholder="misprint / lost sheet" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => setVoidOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!reason.trim() || busy} onClick={confirmVoid}>
            {busy ? "Voiding…" : "Void box"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
