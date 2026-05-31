import { Loader } from "@googlemaps/js-api-loader";

const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

if (!apiKey) {
  console.warn("[googleMaps] Browser key ausente. Conecte o Google Maps Platform connector.");
}

let loaderPromise: Promise<typeof google> | null = null;

function getLoader(): Loader {
  return new Loader({
    apiKey: apiKey ?? "",
    version: "weekly",
    libraries: ["places", "routes", "geocoding", "marker", "geometry"],
    ...(channel ? { channel } : {}),
  });
}

/** Carrega o Google Maps JS SDK (singleton). */
export async function loadGoogleMaps(): Promise<typeof google.maps> {
  if (!loaderPromise) {
    loaderPromise = getLoader().load();
  }
  await loaderPromise;
  return google.maps;
}

export function hasGoogleKey(): boolean {
  return Boolean(apiKey);
}
