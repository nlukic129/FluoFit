"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";

type Box = {
  id: string;
  human_code: string;
  status: string;
  created_at: string;
  activated_at: string | null;
  allocated: boolean;
  total_count: number;
};

const PAGE_SIZE = 50;
const STATUSES = ["unbound", "activated", "void"];
const boxTone = (s: string) => (s === "activated" ? "success" : s === "void" ? "danger" : "info");

export default function BoxesDrilldownPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <BoxesInner />
    </Suspense>
  );
}

function BoxesInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const lot = sp.get("lot");
  const flag = sp.get("flag");

  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Box[]>([]);
  const [total, setTotal] = useState(0);
  const [lotName, setLotName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(0);
  }, [lot, flag, status]);

  useEffect(() => {
    if (!lot) {
      setLotName(null);
      return;
    }
    supabase
      .from("batches")
      .select("name")
      .eq("id", lot)
      .maybeSingle()
      .then(({ data }) => setLotName(data ? (data as { name: string }).name : null));
  }, [lot]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("fn_admin_lot_boxes", {
      p_lot: lot || null,
      p_status: flag ? null : status || null,
      p_flag: flag || null,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    });
    setLoading(false);
    if (error) setError(error.message);
    else {
      const r = (data as Box[]) ?? [];
      setRows(r);
      setTotal(r.length ? Number(r[0]!.total_count) : 0);
    }
  }, [lot, flag, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const title = lotName ? `Boxes — ${lotName}` : "Boxes";

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.push("/provisioning")}>
        <ArrowLeft /> Provisioning
      </Button>

      <PageHeader title={title} subtitle={`${total} boxes`} />

      {flag === "expiring" && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>
            Showing only: <span className="font-medium">expiring (unbound, lot expires within 90 days)</span>
          </span>
          <Link
            href={lot ? `/provisioning/boxes?lot=${lot}` : "/provisioning"}
            className="ml-auto inline-flex items-center gap-1 font-medium hover:underline"
          >
            <X className="size-3.5" /> Clear
          </Link>
        </div>
      )}

      {!flag && (
        <div className="mb-3 flex gap-1">
          {["", ...STATUSES].map((s) => (
            <Button key={s || "all"} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
              {s ? s[0]!.toUpperCase() + s.slice(1) : "All"}
            </Button>
          ))}
        </div>
      )}

      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Human code</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Allocated</TableHead>
            <TableHead>Generated</TableHead>
            <TableHead>Activated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={5}>
                {loading ? "Loading…" : "No boxes match this view."}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((b) => (
              <TableRow key={b.id} className="cursor-pointer" onClick={() => router.push(`/provisioning/box/${b.id}`)}>
                <TableCell className="tabular font-medium">{b.human_code}</TableCell>
                <TableCell>
                  <Badge tone={boxTone(b.status)}>{b.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{b.allocated ? "yes" : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(b.created_at).toLocaleDateString("en-US")}</TableCell>
                <TableCell className="text-muted-foreground">
                  {b.activated_at ? new Date(b.activated_at).toLocaleDateString("en-US") : "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page {page + 1} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft /> Prev
          </Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight />
          </Button>
        </div>
      </div>
    </>
  );
}
