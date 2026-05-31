import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

if (!apiKey) {
  console.warn("[googleMaps] Browser key ausente. Conecte o Google Maps Platform connector.");
}

let configured = false;
function ensureConfigured() {
  if (configured) return;
  setOptions({
    key: apiKey ?? "",
    v: "weekly",
    language: "pt-BR",
    region: "br",
    ...(channel ? { channel } : {}),
  });
  configured = true;
}

let bootPromise: Promise<void> | null = null;

/** Carrega o Google Maps JS SDK (singleton) e devolve google.maps. */
export async function loadGoogleMaps(): Promise<typeof google.maps> {
  ensureConfigured();
  if (!bootPromise) {
    bootPromise = Promise.all([
      importLibrary("maps"),
      importLibrary("places"),
      importLibrary("routes"),
      importLibrary("geocoding"),
      importLibrary("marker"),
      importLibrary("geometry"),
    ]).then(() => undefined);
  }
  await bootPromise;
  return google.maps;
}

export function hasGoogleKey(): boolean {
  return Boolean(apiKey);
}
