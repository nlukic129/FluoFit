"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";

type Member = {
  profile_id: string;
  email: string | null;
  display_name: string | null;
  sub_status: string | null;
  created_at: string;
};

type Member360 = {
  email?: string | null;
  subscription?: { status?: string; refill_mode?: string; cadence_days?: number | null } | null;
  progress?: {
    cumulative_xp?: number;
    current_level?: number;
    current_streak?: number;
    earning_scans_total?: number;
  } | null;
  boxes?: { id: string; human_code: string; status: string }[];
  recent_orders?: { id: string; amount: number; charge_status: string }[];
};

const subTone = (s: string | null) =>
  s === "active" ? "success" : s === "lapsed" || s === "cancelled" ? "danger" : "neutral";

export default function MembersPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Member | null>(null);
  const [detail, setDetail] = useState<Member360 | null>(null);

  async function runSearch() {
    setError(null);
    const { data, error: e } = await supabase.rpc("fn_admin_search_members", {
      p_query: query || null,
    });
    if (e) setError(e.message);
    else setRows((data as Member[]) ?? []);
  }

  async function open(member: Member) {
    setSelected(member);
    setDetail(null);
    const { data, error: e } = await supabase.rpc("fn_admin_member_360", {
      p_profile: member.profile_id,
    });
    if (e) setError(e.message);
    else setDetail(data as Member360);
  }

  return (
    <>
      <PageHeader title="Members" subtitle="Search members and open their 360 view." />

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Search by email or name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
        />
        <Button onClick={runSearch}>
          <Search /> Search
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Subscription</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={4}>
                Search to list members.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((m) => (
              <TableRow key={m.profile_id} className="cursor-pointer" onClick={() => open(m)}>
                <TableCell className="font-medium">{m.email ?? "—"}</TableCell>
                <TableCell>{m.display_name ?? "—"}</TableCell>
                <TableCell>
                  {m.sub_status ? (
                    <Badge tone={subTone(m.sub_status)}>{m.sub_status}</Badge>
                  ) : (
                    <Badge tone="neutral">prospect</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(m.created_at).toLocaleDateString("en-US")}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected?.email ?? "Member"}>
        {!detail ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <MemberDetail member={selected!} detail={detail} onChanged={() => open(selected!)} />
        )}
      </Modal>
    </>
  );
}

function MemberDetail({
  member,
  detail,
  onChanged,
}: {
  member: Member;
  detail: Member360;
  onChanged: () => void;
}) {
  const [xp, setXp] = useState("");
  const [streak, setStreak] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function adjust() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("fn_admin_adjust_progress", {
      p_profile: member.profile_id,
      p_xp: xp === "" ? null : Number(xp),
      p_streak: streak === "" ? null : Number(streak),
      p_reason: reason,
    });
    setBusy(false);
    if (error) setMsg(`⚠️ ${error.message}`);
    else {
      setMsg("✓ Progress corrected.");
      setXp("");
      setStreak("");
      setReason("");
      onChanged();
    }
  }

  const p = detail.progress;
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Level" value={p?.current_level ?? "—"} />
        <Stat label="XP" value={p?.cumulative_xp ?? "—"} />
        <Stat label="Streak" value={p?.current_streak ?? "—"} />
      </div>
      <div className="text-muted-foreground">
        Subscription:{" "}
        <span className="text-foreground">
          {detail.subscription
            ? `${detail.subscription.status} · ${detail.subscription.refill_mode}`
            : "none"}
        </span>
        <br />
        Boxes: <span className="text-foreground">{detail.boxes?.length ?? 0}</span> · Orders:{" "}
        <span className="text-foreground">{detail.recent_orders?.length ?? 0}</span>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
        <p className="font-medium">Correct XP / Streak (audited)</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="xp">XP</Label>
            <Input id="xp" type="number" placeholder="unchanged" value={xp} onChange={(e) => setXp(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="streak">Streak</Label>
            <Input id="streak" type="number" placeholder="unchanged" value={streak} onChange={(e) => setStreak(e.target.value)} />
          </div>
        </div>
        <Input placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button size="sm" disabled={!reason.trim() || busy} onClick={adjust}>
          {busy ? "Saving…" : "Apply correction"}
        </Button>
        {msg && <p className="text-xs">{msg}</p>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular text-lg font-semibold">{value}</div>
    </div>
  );
}
