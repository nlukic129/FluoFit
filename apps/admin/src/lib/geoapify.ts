// Geoapify integration (no billing / no tax info — just an API key, free tier ~3000 req/day).
// Add to apps/admin/.env.local as NEXT_PUBLIC_GEOAPIFY_API_KEY, then restart the dev server.
// Map = Leaflet + Geoapify tiles; address autocomplete = Geoapify Geocoding Autocomplete REST.

/* eslint-disable @typescript-eslint/no-explicit-any */
export const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;

let leafletPromise: Promise<any> | null = null;

// Load Leaflet (the map library, no key needed) once from CDN. Only the tiles need the key.
export function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (!leafletPromise) {
    leafletPromise = new Promise<any>((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.async = true;
      s.onload = () => resolve((window as any).L);
      s.onerror = () => reject(new Error("Leaflet failed to load"));
      document.head.appendChild(s);
    });
  }
  return leafletPromise;
}

export const geoapifyTileUrl = () =>
  `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`;

// Autocomplete (Serbia). `type` = 'city' for the wave city picker, undefined for full addresses.
// Returns Geoapify features (properties: formatted, street, housenumber, city, county, suburb,
// district, postcode, country_code, lat, lon, place_id).
export async function geoapifyAutocomplete(text: string, type?: "city"): Promise<any[]> {
  if (!GEOAPIFY_KEY || text.trim().length < 2) return [];
  const url =
    `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}` +
    (type ? `&type=${type}` : "") +
    `&filter=countrycode:rs&limit=6&format=geojson&apiKey=${GEOAPIFY_KEY}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    return j.features ?? [];
  } catch {
    return [];
  }
}
