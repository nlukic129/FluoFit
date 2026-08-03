"use client";

import { Plus } from "lucide-react";
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
import { cn } from "@/lib/utils";

type Partner = { id: string; name: string; kind: string | null; contact: string | null; active: boolean; valid_until: string | null };
type Perk = { id: string; name: string };
type Level = { id: string; name: string; ordinal: number };

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [perks, setPerks] = useState<Perk[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partner | "new" | null>(null);

  const load = useCallback(async () => {
    const [p, pk, lv] = await Promise.all([
      supabase.from("partners").select("id,name,kind,contact,active,valid_until").order("created_at", { ascending: false }),
      supabase.from("perks").select("id,name"),
      supabase.from("levels").select("id,name,ordinal").order("ordinal"),
    ]);
    if (p.error) setError(p.error.message);
    else setPartners((p.data as Partner[]) ?? []);
    if (pk.data) setPerks(pk.data as Perk[]);
    if (lv.data) setLevels(lv.data as Level[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Partners"
        subtitle="Admin-managed partner records that fund Perks (no partner login in v1)."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus /> Add partner
          </Button>
        }
      />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Partners</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={5}>
                    No partners yet.
                  </TableCell>
                </TableRow>
              ) : (
                partners.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.kind ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.contact ?? "—"}</TableCell>
                    <TableCell>
                      <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "active" : "inactive"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PerkMappingCard partners={partners} perks={perks} levels={levels} onError={setError} />

      {editing && (
        <PartnerModal
          partner={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
          onError={setError}
        />
      )}
    </>
  );
}

function PartnerModal({
  partner,
  onClose,
  onSaved,
  onError,
}: {
  partner: Partner | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(partner?.name ?? "");
  const [kind, setKind] = useState(partner?.kind ?? "gym");
  const [contact, setContact] = useState(partner?.contact ?? "");
  const [active, setActive] = useState(partner?.active ?? true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("fn_upsert_partner", {
      p_id: partner?.id ?? null,
      p_name: name,
      p_kind: kind,
      p_contact: contact || null,
      p_active: active,
      p_valid_until: null,
      p_reason: reason,
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
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={kind} onChange={setKind} options={["gym", "shop", "event"]} />
      </div>
      <div className="space-y-1.5">
        <Label>Contact</Label>
        <Input value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>
      <div className="space-y-1.5">
        <Label>Reason</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="required" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!name || !reason.trim() || busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function PerkMappingCard({
  partners,
  perks,
  levels,
  onError,
}: {
  partners: Partner[];
  perks: Perk[];
  levels: Level[];
  onError: (m: string) => void;
}) {
  const [partner, setPartner] = useState("");
  const [perk, setPerk] = useState("");
  const [level, setLevel] = useState("");
  const [tier, setTier] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function map() {
    const { error } = await supabase.rpc("fn_map_partner_perk", {
      p_partner: partner,
      p_perk: perk,
      p_level: level,
      p_discount_tier: tier,
      p_reason: reason,
    });
    if (error) onError(error.message);
    else {
      setMsg("✓ Mapped.");
      setTimeout(() => setMsg(null), 2000);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Map a funded perk</CardTitle>
        <CardDescription>Attach a Perk to a Partner at a Level with a discount tier.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <Select value={partner} onChange={setPartner} options={partners.map((p) => ({ value: p.id, label: p.name }))} placeholder="Partner" />
        <Select value={perk} onChange={setPerk} options={perks.map((p) => ({ value: p.id, label: p.name }))} placeholder="Perk" />
        <Select value={level} onChange={setLevel} options={levels.map((l) => ({ value: l.id, label: l.name }))} placeholder="Level" />
        <Input placeholder="Tier (e.g. 10% off)" value={tier} onChange={(e) => setTier(e.target.value)} />
        <div className="flex gap-2">
          <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button disabled={!partner || !perk || !level || !reason.trim()} onClick={map}>
            Map
          </Button>
        </div>
        {msg && <p className="text-xs md:col-span-5">{msg}</p>}
      </CardContent>
    </Card>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const opt = typeof o === "string" ? { value: o, label: o } : o;
        return (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        );
      })}
    </select>
  );
}
