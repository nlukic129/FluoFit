"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Suspense, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";

type Box = { id: string; opaque_token: string; human_code: string };

export default function PrintPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <PrintLabels />
    </Suspense>
  );
}

function PrintLabels() {
  const router = useRouter();
  const params = useSearchParams();
  const batch = params.get("batch");

  const [name, setName] = useState("");
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Editor state — physical print sizing.
  const [qrMm, setQrMm] = useState(20);
  const [gapMm, setGapMm] = useState(4);
  const [showCode, setShowCode] = useState(true);
  const [border, setBorder] = useState(true);

  const load = useCallback(async () => {
    if (!batch) return;
    const [b, x] = await Promise.all([
      supabase.from("batches").select("name").eq("id", batch).maybeSingle(),
      supabase.from("boxes").select("id,opaque_token,human_code").eq("batch_id", batch).order("created_at"),
    ]);
    if (b.data) setName((b.data as { name: string }).name);
    if (x.error) setError(x.error.message);
    else setBoxes((x.data as Box[]) ?? []);
  }, [batch]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!batch) return <p className="text-sm text-destructive">Missing batch.</p>;

  const codeMm = Math.max(2, qrMm * 0.14); // human-code font scales with QR

  return (
    <>
      <div className="no-print mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/provisioning")}>
          <ArrowLeft /> Back
        </Button>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Labels — {name}</h1>
            <p className="text-sm text-muted-foreground">
              {boxes.length} labels. Sizes are in millimetres — print at 100% scale (no “fit to page”).
            </p>
          </div>
          <Button onClick={() => window.print()}>
            <Printer /> Print
          </Button>
        </div>

        {/* Editor */}
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-lg border border-border bg-card p-4">
          <NumberField label="QR size (mm)" value={qrMm} onChange={setQrMm} min={8} max={80} />
          <NumberField label="Gap (mm)" value={gapMm} onChange={setGapMm} min={0} max={30} />
          <div className="mx-1 hidden h-9 w-px self-end bg-border sm:block" />
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              style={{ accentColor: "var(--primary)" }}
              checked={showCode}
              onChange={(e) => setShowCode(e.target.checked)}
            />
            Show code
          </label>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              style={{ accentColor: "var(--primary)" }}
              checked={border}
              onChange={(e) => setBorder(e.target.checked)}
            />
            Cut border
          </label>
          <div className="ml-auto self-end text-xs text-muted-foreground">
            {boxes.length} labels · ~{perPage(qrMm, gapMm, showCode)} per A4 page
          </div>
        </div>
      </div>

      {error && <p className="no-print mb-4 text-sm text-destructive">⚠️ {error}</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, ${qrMm + 2 * Math.max(1, gapMm / 2)}mm)`,
          gap: `${gapMm}mm`,
          justifyContent: "start",
        }}
      >
        {boxes.map((b) => (
          <div
            key={b.id}
            style={{
              breakInside: "avoid",
              border: border ? "0.2mm solid #cbd5e1" : "none",
              padding: `${Math.max(1, gapMm / 2)}mm`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: `${codeMm * 0.4}mm`,
              background: "#fff",
            }}
          >
            <QRCodeSVG value={b.opaque_token} size={256} level="M" style={{ width: `${qrMm}mm`, height: `${qrMm}mm` }} />
            {showCode && (
              <div style={{ textAlign: "center", lineHeight: 1.1 }}>
                <div style={{ fontSize: `${codeMm * 0.7}mm`, letterSpacing: "0.15em", color: "#64748b", fontWeight: 600 }}>
                  FLUOFIT
                </div>
                <div
                  style={{
                    fontSize: `${codeMm}mm`,
                    letterSpacing: "0.1em",
                    fontWeight: 600,
                    fontFamily: "var(--font-fira-code), monospace",
                  }}
                >
                  {b.human_code}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// Rough labels-per-A4 estimate (usable area ~200×287mm at default margins).
function perPage(qrMm: number, gapMm: number, showCode: boolean): number {
  const pad = Math.max(1, gapMm / 2);
  const codeMm = Math.max(2, qrMm * 0.14);
  const w = qrMm + 2 * pad + gapMm;
  const h = qrMm + 2 * pad + (showCode ? codeMm * 1.9 : 0) + gapMm;
  const cols = Math.max(1, Math.floor(200 / w));
  const rows = Math.max(1, Math.floor(287 / h));
  return cols * rows;
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </div>
  );
}
