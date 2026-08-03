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

type Wave = { id: string; name: string; soft_cap: number | null; city_focus: string | null; status: string };
type Applicant = {
  application_id: string;
  email: string | null;
  status: string;
  current_level: number;
  current_streak: number;
};

export default function AgentsPage() {
  const [waves, setWaves] = useState<Wave[]>([]);
  const [selected, setSelected] = useState<Wave | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openWave, setOpenWave] = useState(false);

  const loadWaves = useCallback(async () => {
    const { data, error } = await supabase
      .from("intake_waves")
      .select("id,name,soft_cap,city_focus,status")
      .order("opened_at", { ascending: false });
    if (error) setError(error.message);
    else setWaves((data as Wave[]) ?? []);
  }, []);

  useEffect(() => {
    void loadWaves();
  }, [loadWaves]);

  const viewApplicants = useCallback(async (wave: Wave) => {
    setSelected(wave);
    const { data, error } = await supabase.rpc("fn_admin_wave_applicants", { p_wave: wave.id });
    if (error) setError(error.message);
    else setApplicants((data as Applicant[]) ?? []);
  }, []);

  async function decide(app: Applicant, decision: "approved" | "waitlisted") {
    const reason = window.prompt(`${decision} ${app.email}? Reason:`);
    if (!reason) return;
    const { error } = await supabase.rpc("fn_decide_application", {
      p_application: app.application_id,
      p_decision: decision,
      p_reason: reason,
    });
    if (error) setError(error.message);
    else if (selected) await viewApplicants(selected);
  }

  async function close(wave: Wave) {
    const reason = window.prompt(`Close "${wave.name}"? Reason:`);
    if (!reason) return;
    const { error } = await supabase.rpc("fn_close_wave", { p_wave: wave.id, p_reason: reason });
    if (error) setError(error.message);
    else {
      await loadWaves();
      setSelected(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Agents"
        subtitle="Run capped intake waves — curate on Level/engagement, approve, close."
        actions={
          <Button onClick={() => setOpenWave(true)}>
            <Plus /> Open wave
          </Button>
        }
      />
      {error && <p className="mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Waves</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Soft cap</TableHead>
                <TableHead>City focus</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waves.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={5}>
                    No waves yet.
                  </TableCell>
                </TableRow>
              ) : (
                waves.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell className="tabular">{w.soft_cap ?? "—"}</TableCell>
                    <TableCell>{w.city_focus ?? "—"}</TableCell>
                    <TableCell>
                      <Badge tone={w.status === "open" ? "success" : "neutral"}>{w.status}</Badge>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => viewApplicants(w)}>
                        Applicants
                      </Button>
                      {w.status === "open" && (
                        <Button size="sm" variant="outline" onClick={() => close(w)}>
                          Close
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>Applicants — {selected.name}</CardTitle>
            <CardDescription>Ranked by Level then streak (proof they live the product).</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Streak</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applicants.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={5}>
                      No applicants.
                    </TableCell>
                  </TableRow>
                ) : (
                  applicants.map((a) => (
                    <TableRow key={a.application_id}>
                      <TableCell className="font-medium">{a.email ?? "—"}</TableCell>
                      <TableCell className="tabular">{a.current_level}</TableCell>
                      <TableCell className="tabular">{a.current_streak}</TableCell>
                      <TableCell>
                        <Badge tone={a.status === "approved" ? "success" : a.status === "waitlisted" ? "warning" : "neutral"}>
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        {a.status === "applied" && (
                          <>
                            <Button size="sm" onClick={() => decide(a, "approved")}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => decide(a, "waitlisted")}>
                              Waitlist
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {openWave && <OpenWaveModal onClose={() => setOpenWave(false)} onSaved={() => { setOpenWave(false); void loadWaves(); }} onError={setError} />}
    </>
  );
}

function OpenWaveModal({
  onClose,
  onSaved,
  onError,
}: {
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [cap, setCap] = useState("30");
  const [city, setCity] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("fn_open_wave", {
      p_name: name,
      p_soft_cap: cap ? Number(cap) : null,
      p_city_focus: city || null,
      p_niche_note: null,
      p_reason: reason,
    });
    setBusy(false);
    if (error) onError(error.message);
    else onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Open intake wave">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="March wave" />
      </div>
      <div className="space-y-1.5">
        <Label>Soft cap</Label>
        <Input type="number" value={cap} onChange={(e) => setCap(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>City focus (optional)</Label>
        <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Valjevo" />
      </div>
      <div className="space-y-1.5">
        <Label>Reason</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="required" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!name || !reason.trim() || busy} onClick={save}>
          {busy ? "Opening…" : "Open wave"}
        </Button>
      </div>
    </Modal>
  );
}
