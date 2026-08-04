"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";

type Ticket = {
  id: string;
  subject: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  age_days: number;
  profile_id: string;
  member_email: string | null;
  member_name: string | null;
  sub_status: string | null;
};

type TicketDetail = {
  id: string;
  subject: string | null;
  body: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by_email: string | null;
  member: {
    profile_id: string;
    email: string | null;
    name: string | null;
    sub_status: string | null;
    current_level: number;
    last_active: string | null;
    benefit_days: number | null;
  };
};

const STATUSES: { key: string; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "", label: "All" },
];

const subTone = (s: string | null) =>
  s === "active" ? "success" : s === "lapsed" || s === "cancelled" ? "danger" : s ? "warning" : "neutral";

const ageClass = (days: number, status: string) =>
  status !== "open" ? "text-muted-foreground" : days >= 7 ? "font-medium text-red-600" : days >= 3 ? "text-amber-600" : "text-muted-foreground";

export default function SupportPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <SupportInner />
    </Suspense>
  );
}

function SupportInner() {
  const focus = useSearchParams().get("focus");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDq(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("fn_admin_list_tickets", { p_status: status || null, p_query: dq || null });
    if (error) setError(error.message);
    else setTickets((data as Ticket[]) ?? []);
  }, [status, dq]);

  useEffect(() => {
    void load();
  }, [load]);

  // Deep-link: /support?focus=<id> opens that ticket.
  useEffect(() => {
    if (focus) setOpenId(focus);
  }, [focus]);

  const openCount = tickets.filter((t) => t.status === "open").length;

  return (
    <>
      <PageHeader title="Support" subtitle="Ticket inbox — triage a member's problem, then jump to their account to act." />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <Button key={s.key || "all"} size="sm" variant={status === s.key ? "default" : "outline"} onClick={() => setStatus(s.key)}>
              {s.label}
            </Button>
          ))}
        </div>
        <Input className="max-w-xs" placeholder="Search subject or member…" value={q} onChange={(e) => setQ(e.target.value)} />
        {status === "open" && <span className="ml-auto text-sm text-muted-foreground">{openCount} open</span>}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Age</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={5}>
                No tickets match this view.
              </TableCell>
            </TableRow>
          ) : (
            tickets.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => setOpenId(t.id)}>
                <TableCell>
                  <div className="font-medium">{t.member_name ?? t.member_email ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{t.member_email}</div>
                </TableCell>
                <TableCell>{t.subject ?? "—"}</TableCell>
                <TableCell>
                  <Badge tone={t.status === "open" ? "warning" : "success"}>{t.status}</Badge>
                </TableCell>
                <TableCell className={ageClass(t.age_days, t.status)}>
                  {t.status === "open" ? `${t.age_days}d` : "—"}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  <ArrowRight className="size-4" />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {openId && <TicketDrawer ticketId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </>
  );
}

function TicketDrawer({ ticketId, onClose, onChanged }: { ticketId: string; onClose: () => void; onChanged: () => void }) {
  const router = useRouter();
  const [d, setD] = useState<TicketDetail | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("fn_admin_ticket_detail", { p_ticket: ticketId });
    if (error) setErr(error.message);
    else setD(data as TicketDetail);
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: string) {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc(fn, { p_ticket: ticketId, p_reason: reason || null });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setReason("");
      await load();
      onChanged();
    }
  }

  return (
    <Modal open onClose={onClose} title={d?.subject ?? "Ticket"}>
      {err && <p className="text-sm text-destructive">⚠️ {err}</p>}
      {!d ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {/* Member mini */}
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{d.member.name ?? d.member.email ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{d.member.email}</div>
              </div>
              <Badge tone={subTone(d.member.sub_status)}>{d.member.sub_status ?? "prospect"}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Level {d.member.current_level}</span>
              <span>Benefit clock: {d.member.benefit_days != null ? `${d.member.benefit_days}d` : "—"}</span>
              <span>Last active: {d.member.last_active ?? "—"}</span>
            </div>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => router.push(`/members/${d.member.profile_id}`)}
            >
              Open member <ArrowRight />
            </Button>
          </div>

          {/* Body */}
          <div className="space-y-1">
            <Label>Message</Label>
            <p className="whitespace-pre-wrap rounded-md border border-border p-3 text-sm">
              {d.body ?? <span className="text-muted-foreground">No message body.</span>}
            </p>
            <p className="text-xs text-muted-foreground">Opened {new Date(d.created_at).toLocaleString("en-US")}</p>
          </div>

          {/* Resolve / reopen */}
          {d.status === "open" ? (
            <div className="space-y-2">
              <Label htmlFor="ticket-note">Resolution note (optional — audited)</Label>
              <Input id="ticket-note" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="what you did / outcome" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>Close</Button>
                <Button disabled={busy} onClick={() => run("fn_resolve_ticket")}>
                  {busy ? "Resolving…" : "Resolve ticket"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Resolved {d.resolved_at ? new Date(d.resolved_at).toLocaleDateString("en-US") : ""}
                {d.resolved_by_email ? ` by ${d.resolved_by_email}` : ""}
              </span>
              <Button variant="outline" disabled={busy} onClick={() => run("fn_reopen_ticket")}>
                {busy ? "Reopening…" : "Reopen"}
              </Button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
