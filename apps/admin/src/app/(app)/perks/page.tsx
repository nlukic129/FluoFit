"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { type PerkLite } from "@/components/perk-modal";
import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";

type Partner = { id: string; name: string; kind: string | null; contact: string | null; active: boolean; valid_until: string | null; perk_count: number; expired: boolean };
const fundingTone = (f: string) => (f === "partner" ? "info" : f === "spend" ? "warning" : "neutral");

export default function PerksPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [fperks, setFperks] = useState<PerkLite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingPartner, setEditingPartner] = useState<Partner | "new" | null>(null);

  const load = useCallback(async () => {
    const [pt, pk] = await Promise.all([
      supabase.rpc("fn_admin_list_partners"),
      supabase.from("perks").select("id,name,benefit,funding,cost_hint,is_public,level_id,code").is("partner_id", null).order("name"),
    ]);
    if (pt.error) setError(pt.error.message);
    else setPartners((pt.data as Partner[]) ?? []);
    if (pk.error) setError(pk.error.message);
    else setFperks((pk.data as PerkLite[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader title="Perks" subtitle="FluoFit perks are built into the system; partner perks are managed here. Level rewards are attached in Gamification." />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <div className="space-y-6">
        {/* FluoFit perks */}
        <Card>
          <CardHeader>
            <CardTitle>FluoFit perks</CardTitle>
            <CardDescription>
              Each FluoFit perk (e.g. free shipping, a free box with the next order) is built and integrated into
              the system, so this list is read-only — new ones are added by the team once wired. You assign them to
              a Level in Gamification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Benefit</TableHead>
                  <TableHead>Funding</TableHead>
                  <TableHead>Level reward</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fperks.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={4}>No FluoFit perks yet.</TableCell>
                  </TableRow>
                ) : (
                  fperks.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.benefit ?? "—"}</TableCell>
                      <TableCell>
                        <Badge tone={fundingTone(p.funding)}>{p.funding}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.level_id ? "attached" : "unattached"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Partners */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Partners</CardTitle>
              <CardDescription>Add a partner, then open it to manage the perks it funds.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setEditingPartner("new")}>
              <Plus /> Add partner
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Perks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={6}>No partners yet.</TableCell>
                  </TableRow>
                ) : (
                  partners.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/perks/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                      </TableCell>
                      <TableCell>{p.kind ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.contact ?? "—"}</TableCell>
                      <TableCell className="tabular">{p.perk_count}</TableCell>
                      <TableCell>
                        {p.expired ? <Badge tone="danger">expired</Badge> : <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "active" : "inactive"}</Badge>}
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Link href={`/perks/${p.id}`} className={buttonVariants({ size: "sm" })}>Manage perks</Link>
                        <Button size="sm" variant="outline" onClick={() => setEditingPartner(p)}>Edit</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {editingPartner && (
        <PartnerModal partner={editingPartner === "new" ? null : editingPartner} onClose={() => setEditingPartner(null)} onSaved={() => { setEditingPartner(null); void load(); }} onError={setError} />
      )}
    </>
  );
}

function PartnerModal({ partner, onClose, onSaved, onError }: { partner: Partner | null; onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [name, setName] = useState(partner?.name ?? "");
  const [kind, setKind] = useState(partner?.kind ?? "gym");
  const [contact, setContact] = useState(partner?.contact ?? "");
  const [active, setActive] = useState(partner?.active ?? true);
  const [validUntil, setValidUntil] = useState(partner?.valid_until ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("fn_upsert_partner", {
      p_id: partner?.id ?? null, p_name: name, p_kind: kind, p_contact: contact || null,
      p_active: active, p_valid_until: validUntil || null, p_reason: partner ? "Edited partner" : "Added partner",
    });
    setBusy(false);
    if (error) onError(error.message);
    else onSaved();
  }

  return (
    <Modal open onClose={onClose} title={partner ? "Edit partner" : "Add partner"}>
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="gym">gym</option>
            <option value="shop">shop</option>
            <option value="event">event</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Valid until (optional)</Label>
          <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Contact</Label>
        <Input value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ accentColor: "var(--primary)" }} />
        Active
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!name || busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
      </div>
    </Modal>
  );
}
