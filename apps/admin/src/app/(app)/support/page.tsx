"use client";

import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";

type Ticket = { id: string; subject: string | null; status: string; created_at: string };

// Generic override definitions — each maps a small form to an audited admin RPC (0014).
type OverrideField = { name: string; label: string; optional?: boolean };
type Override = {
  key: string;
  title: string;
  description: string;
  rpc: string;
  fields: OverrideField[];
  toParams: (v: Record<string, string>) => Record<string, unknown>;
};

const OVERRIDES: Override[] = [
  {
    key: "activate",
    title: "Manual activation",
    description: "Activate a Box for a member when the QR/code fails.",
    rpc: "fn_admin_manual_activate",
    fields: [
      { name: "code", label: "Box code (QR token or human code)" },
      { name: "profile", label: "Member profile ID" },
      { name: "reason", label: "Reason" },
    ],
    toParams: (v) => ({ p_code: v.code, p_profile: v.profile, p_reason: v.reason }),
  },
  {
    key: "unbind",
    title: "Unbind / rebind Box",
    description: "Detach a Box from the wrong account, optionally rebind it.",
    rpc: "fn_admin_unbind_rebind",
    fields: [
      { name: "box", label: "Box ID" },
      { name: "newProfile", label: "Rebind to member ID", optional: true },
      { name: "reason", label: "Reason" },
    ],
    toParams: (v) => ({ p_box_id: v.box, p_new_profile: v.newProfile || null, p_reason: v.reason }),
  },
  {
    key: "attribution",
    title: "Fix attribution",
    description: "Assign or change the referrer for a subscription.",
    rpc: "fn_admin_fix_attribution",
    fields: [
      { name: "subscription", label: "Subscription ID" },
      { name: "referrer", label: "Referrer (profile) ID" },
      { name: "reason", label: "Reason" },
    ],
    toParams: (v) => ({ p_subscription: v.subscription, p_referrer: v.referrer, p_reason: v.reason }),
  },
  {
    key: "release",
    title: "Release held commission",
    description: "Release a held commission to payable after review.",
    rpc: "fn_admin_release_commission",
    fields: [
      { name: "commission", label: "Commission ID" },
      { name: "reason", label: "Reason" },
    ],
    toParams: (v) => ({ p_id: v.commission, p_reason: v.reason }),
  },
];

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Override | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from("support_tickets")
      .select("id,subject,status,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (e) setError(e.message);
    else setTickets((data as Ticket[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(id: string) {
    const { error: e } = await supabase.rpc("fn_resolve_ticket", { p_ticket: id, p_reason: null });
    if (e) setError(e.message);
    else await load();
  }

  return (
    <>
      <PageHeader title="Support" subtitle="Ticket queue and the audited override toolkit." />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Ticket queue</CardTitle>
          <CardDescription>In-app “Contact support” lands here.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={4}>
                    No tickets.
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.subject ?? "—"}</TableCell>
                    <TableCell>
                      <Badge tone={t.status === "open" ? "warning" : "success"}>{t.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("en-US")}
                    </TableCell>
                    <TableCell className="text-right">
                      {t.status === "open" && (
                        <Button size="sm" variant="outline" onClick={() => resolve(t.id)}>
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Override toolkit</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {OVERRIDES.map((o) => (
          <Card key={o.key}>
            <CardHeader>
              <CardTitle>{o.title}</CardTitle>
              <CardDescription>{o.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" onClick={() => setActive(o)}>
                Open
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {active && <OverrideModal override={active} onClose={() => setActive(null)} />}
    </>
  );
}

function OverrideModal({ override, onClose }: { override: Override; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const missingRequired = override.fields.some((f) => !f.optional && !(values[f.name] ?? "").trim());

  async function submit() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc(override.rpc, override.toParams(values));
    setBusy(false);
    if (error) setMsg(`⚠️ ${error.message}`);
    else setMsg("✓ Done.");
  }

  return (
    <Modal open onClose={onClose} title={override.title}>
      {override.fields.map((f) => (
        <div key={f.name} className="space-y-1.5">
          <Label htmlFor={f.name}>
            {f.label}
            {f.optional && <span className="text-muted-foreground"> (optional)</span>}
          </Label>
          <Input
            id={f.name}
            value={values[f.name] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
          />
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        {msg && <p className="text-xs">{msg}</p>}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button disabled={missingRequired || busy} onClick={submit}>
            {busy ? "Running…" : "Apply"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
