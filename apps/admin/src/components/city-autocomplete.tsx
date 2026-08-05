"use client";

import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { GEOAPIFY_KEY, geoapifyAutocomplete } from "@/lib/geoapify";

/* eslint-disable @typescript-eslint/no-explicit-any */
// City picker (Geoapify type=city, Serbia). Returns a canonical Latin-Serbian city name so it matches
// member ship_city and the intake gate. Falls back to a plain text field when no key is set.
export function CityAutocomplete({ value, onChange }: { value: string; onChange: (city: string) => void }) {
  const [q, setQ] = useState(value);
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const skip = useRef(false);

  useEffect(() => {
    setQ(value);
  }, [value]);

  useEffect(() => {
    if (!GEOAPIFY_KEY || skip.current) {
      skip.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const feats = await geoapifyAutocomplete(q, "city");
      setResults(feats);
      setOpen(feats.length > 0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function pick(f: any) {
    const city = f.properties?.city ?? f.properties?.formatted ?? "";
    skip.current = true;
    setQ(city);
    setOpen(false);
    onChange(city);
  }

  return (
    <div className="relative space-y-1">
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          onChange(e.target.value); // keep parent in sync even without a pick (still validated by dropdown)
        }}
        placeholder={GEOAPIFY_KEY ? "Type a city…" : "City (autocomplete disabled — no Geoapify key)"}
      />
      {open && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-md">
          {results.map((f, i) => {
            const label = f.properties?.city ?? f.properties?.formatted;
            return (
              <button key={f.properties?.place_id ?? i} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => pick(f)}>
                {label}
                <span className="ml-2 text-xs text-muted-foreground">{f.properties?.formatted}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
