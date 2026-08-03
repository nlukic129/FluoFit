"use client";

import { Download, Plus, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";

type Batch = { id: string; name: string; unit_count: number; created_at: string };
type Box = { id: string; human_code: string; status: string; batch_id: string; created_at: string };
type Filter = "all" | "unbound" | "activated" | "void";

const FILTERS: Filter[] = ["all", "unbound", "activated", "void"];
const boxTone = (s: string) =>
  s === "activated" ? "success" : s === "void" ? "danger" : "info";

export default function ProvisioningPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const [genOpen, setGenOpen] = useState(false);
  const [name, setName] = useState("");
  const [count, setCount] = useState("500");
  const [busy, setBusy] = useState(false);

  const [voidTarget, setVoidTarget] = useState<Box | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setError(null);
    let boxQuery = supabase
      .from("boxes")
      .select("id,human_code,status,batch_id,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter !== "all") boxQuery = boxQuery.eq("status", filter);

    const [b, x] = await Promise.all([
      supabase.from("batches").select("id,name,unit_count,created_at").order("created_at", { ascending: false }),
      boxQuery,
    ]);
    if (b.error) setError(b.error.message);
    else setBatches(b.data as Batch[]);
    if (x.error) setError(x.error.message);
    else setBoxes(x.data as Box[]);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createBatch() {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("fn_provision_batch", {
      p_name: name,
      p_count: Number(count),
    });
    setBusy(false);
    if (e) setError(e.message);
    else {
      setGenOpen(false);
      setName("");
      await load();
    }
  }

  async function confirmVoid() {
    if (!voidTarget) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("fn_void_box", {
      p_box_id: voidTarget.id,
      p_reason: reason,
    });
    setBusy(false);
    if (e) setError(e.message);
    else {
      setVoidTarget(null);
      setReason("");
      await load();
    }
  }

  function exportCsv() {
    const rows = [
      ["human_code", "status", "batch_id", "created_at"],
      ...boxes.map((b) => [b.human_code, b.status, b.batch_id, b.created_at]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "fluofit-boxes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Provisioning"
        subtitle="Generate, track, and void Box codes in named batches."
        actions={
          <Button onClick={() => setGenOpen(true)}>
            <Plus /> New batch
          </Button>
        }
      />

      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Batches ({batches.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Labels</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={4}>
                    No batches yet — generate one to start.
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="tabular">{b.unit_count}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(b.created_at).toLocaleDateString("en-US")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/provisioning/print?batch=${b.id}`)}
                      >
                        <Printer /> Print labels
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f[0]!.toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={boxes.length === 0}>
          <Download /> Export CSV
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Human code</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {boxes.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={4}>
                No boxes match this filter.
              </TableCell>
            </TableRow>
          ) : (
            boxes.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="tabular font-medium">{b.human_code}</TableCell>
                <TableCell>
                  <Badge tone={boxTone(b.status)}>{b.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(b.created_at).toLocaleDateString("en-US")}
                </TableCell>
                <TableCell className="text-right">
                  {b.status === "unbound" && (
                    <Button size="sm" variant="destructive" onClick={() => setVoidTarget(b)}>
                      Void
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate batch">
        <div className="space-y-1.5">
          <Label htmlFor="batch-name">Batch name</Label>
          <Input id="batch-name" placeholder="Batch #12 — March" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="batch-count">Number of boxes</Label>
          <Input id="batch-count" type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => setGenOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!name || !(Number(count) > 0) || busy} onClick={createBatch}>
            {busy ? "Generating…" : "Generate"}
          </Button>
        </div>
      </Modal>

      <Modal open={voidTarget !== null} onClose={() => setVoidTarget(null)} title="Void box">
        <p className="text-sm text-muted-foreground">
          Voiding <span className="tabular font-medium text-foreground">{voidTarget?.human_code}</span>{" "}
          permanently prevents activation. A reason is required (audited).
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="void-reason">Reason</Label>
          <Input id="void-reason" placeholder="misprint / lost sheet" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => setVoidTarget(null)}>
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
