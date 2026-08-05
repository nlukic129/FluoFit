"use client";

import { ArrowLeft, Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PerkModal, type PerkLite } from "@/components/perk-modal";
import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";

type Perk = PerkLite & { level_ordinal: number | null; level_name: string | null };
type Detail = {
  id: string; name: string; kind: string | null; contact: string | null; active: boolean;
  valid_until: string | null; expired: boolean; perks: Perk[];
};

const fundingTone = (f: string) => (f === "partner" ? "info" : f === "spend" ? "warning" : "neutral");

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Perk | "new" | null>(null);
  const [delTarget, setDelTarget] = useState<Perk | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("fn_admin_partner_detail", { p_id: id });
    if (error) setError(error.message);
    else setD(data as Detail);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="text-sm text-destructive">⚠️ {error}</p>;
  if (!d) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => router.push("/perks")}>
        <ArrowLeft /> Perks
      </Button>
      <PageHeader
        title={d.name}
        subtitle={`${d.kind ?? "—"}${d.contact ? ` · ${d.contact}` : ""}${d.valid_until ? ` · valid until ${new Date(d.valid_until).toLocaleDateString("en-US")}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            {d.expired ? <Badge tone="danger">expired</Badge> : <Badge tone={d.active ? "success" : "neutral"}>{d.active ? "active" : "inactive"}</Badge>}
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus /> Add perk
            </Button>
          </div>
        }
      />

      {(d.expired || !d.active) && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This partner is {d.expired ? "expired" : "inactive"} — its perks won&apos;t be shown to members.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Perks ({d.perks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Perk</TableHead>
                <TableHead>Benefit</TableHead>
                <TableHead>Funding</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.perks.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={5}>No perks yet — add one this partner funds.</TableCell>
                </TableRow>
              ) : (
                d.perks.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.benefit ?? "—"}</TableCell>
                    <TableCell>
                      <Badge tone={fundingTone(p.funding)}>{p.funding}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.is_public ? "Public" : p.level_name ? `Level reward · ${p.level_name}` : "Level reward · unattached"}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <button className="text-xs font-medium text-primary hover:underline" onClick={() => setEditing(p)}>Edit</button>
                      <button className="text-xs font-medium text-destructive hover:underline" onClick={() => setDelTarget(p)}>Delete</button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (
        <PerkModal perk={editing === "new" ? null : editing} partnerId={d.id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />
      )}
      {delTarget && <DeletePerkModal perk={delTarget} onClose={() => setDelTarget(null)} onDone={load} />}
    </>
  );
}

function DeletePerkModal({ perk, onClose, onDone }: { perk: { id: string; name: string }; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("fn_delete_perk", { p_id: perk.id, p_reason: reason });
    setBusy(false);
    if (error) setErr(error.message);
    else { onDone(); onClose(); }
  }
  return (
    <Modal open onClose={onClose} title={`Delete "${perk.name}"`}>
      <div className="space-y-1.5">
        <Label>Reason (audited)</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {err && <p className="text-sm text-destructive">⚠️ {err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" disabled={!reason.trim() || busy} onClick={go}>{busy ? "Deleting…" : "Delete perk"}</Button>
      </div>
    </Modal>
  );
}
