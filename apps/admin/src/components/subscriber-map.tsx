"use client";

import { useEffect, useRef, useState } from "react";

import { GEOAPIFY_KEY, geoapifyTileUrl, loadLeaflet } from "@/lib/geoapify";

export type MapPoint = {
  profile_id: string;
  display_name: string | null;
  sub_status: string;
  city: string | null;
  municipality: string | null;
  lat: number;
  lng: number;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const markerColor = (s: string) =>
  s === "active" ? "#059669" : s === "paused" ? "#D97706" : "#DC2626"; // churned (lapsed/cancelled) = red

export function SubscriberMap({ points }: { points: MapPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!GEOAPIFY_KEY) return;
    let cancelled = false;
    loadLeaflet()
      .then((L: any) => {
        if (cancelled || !ref.current) return;
        if (!mapRef.current) {
          mapRef.current = L.map(ref.current).setView([44.05, 20.9], 7);
          L.tileLayer(geoapifyTileUrl(), {
            attribution: 'Powered by <a href="https://www.geoapify.com/">Geoapify</a> · © OpenStreetMap',
            maxZoom: 20,
          }).addTo(mapRef.current);
          layerRef.current = L.layerGroup().addTo(mapRef.current);
        }
        layerRef.current.clearLayers();
        points.forEach((p) =>
          L.circleMarker([Number(p.lat), Number(p.lng)], {
            radius: 5,
            color: "#ffffff",
            weight: 1,
            fillColor: markerColor(p.sub_status),
            fillOpacity: 0.85,
          })
            .bindTooltip(`${p.display_name ?? "—"} · ${p.municipality ?? p.city ?? ""} · ${p.sub_status}`)
            .addTo(layerRef.current),
        );
      })
      .catch(() => setErr("Map failed to load — check the Geoapify API key."));
    return () => {
      cancelled = true;
    };
  }, [points]);

  if (!GEOAPIFY_KEY) return <NoKey />;
  if (err) return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">⚠️ {err}</div>;
  return <div ref={ref} className="h-[600px] w-full rounded-lg border border-border" />;
}

function NoKey() {
  return (
    <div className="flex h-[600px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
      <div className="text-sm font-medium">Map needs a Geoapify API key</div>
      <p className="max-w-md text-xs text-muted-foreground">
        Add <code className="rounded bg-muted px-1">NEXT_PUBLIC_GEOAPIFY_API_KEY</code> to{" "}
        <code className="rounded bg-muted px-1">apps/admin/.env.local</code> and restart the dev server. The subscriber
        breakdown below works without it.
      </p>
    </div>
  );
}
