import { Loader } from "@googlemaps/js-api-loader";

const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

if (!apiKey) {
  console.warn("[googleMaps] Browser key ausente. Conecte o Google Maps Platform connector.");
}

let loader: Loader | null = null;

function getLoader(): Loader {
  if (!loader) {
    loader = new Loader({
      apiKey: apiKey ?? "",
      version: "weekly",
      libraries: ["places", "routes", "geocoding", "marker"],
      ...(channel ? { channel } : {}),
    });
  }
  return loader;
}

/** Carrega o Google Maps JS SDK e devolve o namespace google.maps. */
export async function loadGoogleMaps(): Promise<typeof google.maps> {
  await getLoader().importLibrary("maps");
  await getLoader().importLibrary("places");
  await getLoader().importLibrary("routes");
  await getLoader().importLibrary("geocoding");
  return google.maps;
}

export function hasGoogleKey(): boolean {
  return Boolean(apiKey);
}
