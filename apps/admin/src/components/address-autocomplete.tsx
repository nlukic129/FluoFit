"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { GEOAPIFY_KEY, geoapifyAutocomplete } from "@/lib/geoapify";

export type PickedAddress = {
  line1: string;
  city: string | null;
  municipality: string | null;
  postal: string | null;
  country: string | null;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
// Geoapify-backed address autocomplete (Serbia). Falls back to a plain text box when no key is set.
// On select, fills city / municipality (opština) / lat-lng / place_id.
export function AddressAutocomplete({ onPick }: { onPick: (a: PickedAddress) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!GEOAPIFY_KEY) return;
    const t = setTimeout(async () => {
      const feats = await geoapifyAutocomplete(q);
      setResults(feats);
      setOpen(feats.length > 0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function pick(f: any) {
    const p = f.properties ?? {};
    onPick({
      line1: [p.street, p.housenumber].filter(Boolean).join(" ") || p.address_line1 || p.formatted || "",
      city: p.city ?? p.town ?? p.village ?? null,
      // opština: Belgrade municipalities come back as suburb/district; else fall back to county/city
      municipality: p.suburb ?? p.district ?? p.county ?? p.city ?? null,
      postal: p.postcode ?? null,
      country: p.country_code ? String(p.country_code).toUpperCase() : null,
      place_id: p.place_id ?? null,
      lat: p.lat ?? null,
      lng: p.lon ?? null,
    });
    setQ(p.formatted ?? "");
    setOpen(false);
  }

  return (
    <div className="relative space-y-1">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={GEOAPIFY_KEY ? "Start typing an address…" : "Address (autocomplete disabled — no Geoapify key)"}
      />
      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-card shadow-md">
          {results.map((f, i) => (
            <button
              key={f.properties?.place_id ?? i}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => pick(f)}
            >
              {f.properties?.formatted}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
