"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";

type Member = {
  profile_id: string;
  email: string | null;
  display_name: string | null;
  sub_status: string | null;
  city: string | null;
  created_at: string;
  total_count: number;
};

const PAGE_SIZE = 20;
const STATUSES = ["active", "lapsed", "paused", "cancelled", "prospect"];
const subTone = (s: string | null) =>
  s === "active" ? "success" : s === "lapsed" || s === "cancelled" ? "danger" : s ? "warning" : "neutral";

export default function MembersPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState(""); // debounced query
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [cities, setCities] = useState<{ city: string; members: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search box; reset to first page on new query.
  useEffect(() => {
    const t = setTimeout(() => {
      setDq(q);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // City filter options (once).
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
    });
    setLoading(false);
    if (error) setError(error.message);
    else {
      const r = (data as Member[]) ?? [];
      setRows(r);
      setTotal(r.length ? Number(r[0]!.total_count) : 0);
    }
  }, [dq, status, city, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Members" subtitle="All members — filter and page through." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search email or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
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
        {(q || status || city) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setStatus("");
              setCity("");
              setPage(0);
            }}
          >
            Clear
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{total} members</span>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Subscription</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={5}>
                {loading ? "Loading…" : "No members match these filters."}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((m) => (
              <TableRow key={m.profile_id} className="cursor-pointer" onClick={() => router.push(`/members/${m.profile_id}`)}>
                <TableCell className="font-medium">{m.email ?? "—"}</TableCell>
                <TableCell>{m.display_name ?? "—"}</TableCell>
                <TableCell>{m.city ?? "—"}</TableCell>
                <TableCell>
                  <Badge tone={subTone(m.sub_status)}>{m.sub_status ?? "prospect"}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(m.created_at).toLocaleDateString("en-US")}
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
