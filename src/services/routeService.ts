import { loadGoogleMaps } from "./googleMapsService";

export type TravelMode = "WALKING" | "TRANSIT" | "DRIVING" | "BICYCLING";

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  mode: string;
  transitLine?: string;
  transitVehicle?: string;
}

export interface RouteResult {
  summary: string;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  transfers: number;
  steps: RouteStep[];
  overviewPolyline: string;
  bounds: google.maps.LatLngBoundsLiteral;
  raw: google.maps.DirectionsRoute;
}

export interface DirectionsResponse {
  routes: RouteResult[];
}

/** Calcula rotas (com alternativas) usando Google Directions client-side. */
export async function computeRoutes(
  origin: { lat: number; lng: number } | string,
  destination: { lat: number; lng: number } | string,
  mode: TravelMode = "TRANSIT",
): Promise<DirectionsResponse> {
  const maps = await loadGoogleMaps();
  const service = new maps.DirectionsService();
  const result = await service.route({
    origin,
    destination,
    travelMode: maps.TravelMode[mode],
    provideRouteAlternatives: true,
    region: "br",
    language: "pt-BR",
    ...(mode === "TRANSIT"
      ? {
          transitOptions: {
            modes: [
              maps.TransitMode.BUS,
              maps.TransitMode.SUBWAY,
              maps.TransitMode.TRAIN,
              maps.TransitMode.RAIL,
            ],
            routingPreference: maps.TransitRoutePreference.FEWER_TRANSFERS,
          },
        }
      : {}),
  });

  const routes: RouteResult[] = result.routes.map((r) => {
    const leg = r.legs[0];
    const steps: RouteStep[] = leg.steps.map((s) => ({
      instruction: stripHtml(s.instructions || ""),
      distanceMeters: s.distance?.value ?? 0,
      durationSeconds: s.duration?.value ?? 0,
      mode: s.travel_mode,
      transitLine: s.transit?.line?.short_name || s.transit?.line?.name,
      transitVehicle: s.transit?.line?.vehicle?.name,
    }));
    const transfers =
      steps.filter((st) => st.mode === "TRANSIT").length > 0
        ? Math.max(0, steps.filter((st) => st.mode === "TRANSIT").length - 1)
        : 0;
    return {
      summary: r.summary,
      totalDistanceMeters: leg.distance?.value ?? 0,
      totalDurationSeconds: leg.duration?.value ?? 0,
      transfers,
      steps,
      overviewPolyline: r.overview_polyline,
      bounds: {
        north: r.bounds.getNorthEast().lat(),
        east: r.bounds.getNorthEast().lng(),
        south: r.bounds.getSouthWest().lat(),
        west: r.bounds.getSouthWest().lng(),
      },
      raw: r,
    };
  });
  return { routes };
}

function stripHtml(s: string): string {
  const d = document.createElement("div");
  d.innerHTML = s;
  return d.textContent ?? d.innerText ?? "";
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}
