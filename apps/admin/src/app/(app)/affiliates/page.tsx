"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";

type Referrer = {
  profile_id: string;
  email: string | null;
  status: string;
  ref_code: string;
  fixed_pct: number | null;
  active_subs: number;
};

export default function AffiliatesPage() {
  const [rows, setRows] = useState<Referrer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("fn_admin_list_referrers", { p_type: "affiliate" });
    if (error) setError(error.message);
    else setRows((data as Referrer[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function offboard(r: Referrer) {
    const reason = window.prompt(`Offboard ${r.email}? Reason:`);
    if (!reason) return;
    const { error } = await supabase.rpc("fn_offboard_referrer", { p_profile: r.profile_id, p_reason: reason });
    if (error) setError(error.message);
    else await load();
  }

  return (
    <>
      <PageHeader
        title="Affiliates"
        subtitle="Curated referrers on a fixed negotiated %. Added against an existing account."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add affiliate
          </Button>
        }
      />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Ref code</TableHead>
            <TableHead>Fixed %</TableHead>
            <TableHead>Active subs</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={6}>
                No affiliates yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.profile_id}>
                <TableCell className="font-medium">{r.email ?? "—"}</TableCell>
                <TableCell className="tabular">{r.ref_code}</TableCell>
                <TableCell className="tabular">{r.fixed_pct != null ? `${r.fixed_pct}%` : "—"}</TableCell>
                <TableCell className="tabular">{r.active_subs}</TableCell>
                <TableCell>
                  <Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {r.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => offboard(r)}>
                      Offboard
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {adding && <AddAffiliateModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void load(); }} onError={setError} />}
    </>
  );
}

function AddAffiliateModal({
  onClose,
  onSaved,
  onError,
}: {
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [pct, setPct] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("fn_add_affiliate", {
      p_email: email,
      p_fixed_pct: Number(pct),
      p_reason: reason,
    });
    setBusy(false);
    if (error) onError(error.message);
    else onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Add affiliate">
      <p className="text-sm text-muted-foreground">
        The person must already have a FluoFit account (they sign up first).
      </p>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="trainer@example.com" />
      </div>
      <div className="space-y-1.5">
        <Label>Fixed commission %</Label>
        <Input type="number" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="15" />
      </div>
      <div className="space-y-1.5">
        <Label>Reason</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="required" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!email.includes("@") || !pct || !reason.trim() || busy} onClick={save}>
          {busy ? "Adding…" : "Add affiliate"}
        </Button>
      </div>
    </Modal>
  );
}
