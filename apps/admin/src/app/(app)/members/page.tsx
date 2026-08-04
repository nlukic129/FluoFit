"use client";

import { ArrowDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rsd } from "@/lib/overview";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Member = {
  profile_id: string;
  email: string | null;
  display_name: string | null;
  sub_status: string | null;
  city: string | null;
  created_at: string;
  current_level: number;
  last_active: string | null;
  lifetime_spend: number;
  total_count: number;
};

type Sort = "joined" | "last_active" | "spend";

const daysAgo = (d: string | null) => {
  if (!d) return null;
  const n = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  return n <= 0 ? "today" : `${n}d ago`;
};

const PAGE_SIZE = 20;
const STATUSES = ["active", "lapsed", "paused", "cancelled", "prospect"];
const FLAG_LABEL: Record<string, string> = {
  lapse_risk: "Lapse-risk (benefit clock ≤ 5 days)",
  smart_pending: "Smart, not scanning yet",
};
const subTone = (s: string | null) =>
  s === "active" ? "success" : s === "lapsed" || s === "cancelled" ? "danger" : s ? "warning" : "neutral";

function SortHead({ label, active, onClick, className }: { label: string; active: boolean; onClick: () => void; className?: string }) {
  return (
    <TableHead className={cn("cursor-pointer select-none hover:text-foreground", className)} onClick={onClick}>
      <span className={cn("inline-flex items-center gap-1", active && "text-foreground")}>
        {label}
        {active && <ArrowDown className="size-3" />}
      </span>
    </TableHead>
  );
}

export default function MembersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <MembersInner />
    </Suspense>
  );
}

function MembersInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const flag = sp.get("flag");

  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState<Sort>("joined");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [cities, setCities] = useState<{ city: string; members: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDq(q);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // Reset to first page whenever the cohort flag changes.
  useEffect(() => {
    setPage(0);
  }, [flag]);

  useEffect(() => {
    supabase.rpc("fn_admin_member_cities").then(({ data }) => {
      if (data) setCities(data as { city: string; members: number }[]);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("fn_admin_list_members", {
      p_query: dq || null,
      p_status: status || null,
      p_city: city || null,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
      p_flag: flag || null,
      p_sort: sort,
    });
    setLoading(false);
    if (error) setError(error.message);
    else {
      const r = (data as Member[]) ?? [];
      setRows(r);
      setTotal(r.length ? Number(r[0]!.total_count) : 0);
    }
  }, [dq, status, city, page, flag, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Members" subtitle="All members — filter and page through." />

      {flag && FLAG_LABEL[flag] && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>
            Showing only: <span className="font-medium">{FLAG_LABEL[flag]}</span>
          </span>
          <Link href="/members" className="ml-auto inline-flex items-center gap-1 font-medium hover:underline">
            <X className="size-3.5" /> Clear
          </Link>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" placeholder="Search any part of email or name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select
          className="w-40"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select
          className="w-48"
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c.city} value={c.city}>
              {c.city} ({c.members})
            </option>
          ))}
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">{total} members</span>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Subscription</TableHead>
            <TableHead>Level</TableHead>
            <SortHead label="Last active" active={sort === "last_active"} onClick={() => { setSort("last_active"); setPage(0); }} />
            <SortHead label="Lifetime spend" active={sort === "spend"} onClick={() => { setSort("spend"); setPage(0); }} className="text-right" />
            <TableHead>City</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={7}>
                {loading ? "Loading…" : "No members match these filters."}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((m) => (
              <TableRow key={m.profile_id} className="cursor-pointer" onClick={() => router.push(`/members/${m.profile_id}`)}>
                <TableCell className="font-medium">{m.email ?? "—"}</TableCell>
                <TableCell>{m.display_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge tone={subTone(m.sub_status)}>{m.sub_status ?? "prospect"}</Badge>
                </TableCell>
                <TableCell className="tabular">{m.current_level}</TableCell>
                <TableCell className="text-muted-foreground">{daysAgo(m.last_active) ?? "—"}</TableCell>
                <TableCell className="tabular text-right">{Number(m.lifetime_spend) > 0 ? rsd(m.lifetime_spend) : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{m.city ?? "—"}</TableCell>
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
