import { searchNearbyTransit, type NearbyPlace } from "./placesService";
import { databaseService } from "./databaseService";
import { haversine } from "./locationService";

export interface NearbyLine {
  id: string;
  lineCode: string;
  lineName: string;
  transportType: string;
  origin: string;
  destination: string;
  distanceMeters: number;
  closestStop?: NearbyPlace;
}

const CACHE_KEY = "aptransp_nearby_cache_v1";
const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheShape {
  ts: number;
  lat: number;
  lng: number;
  places: NearbyPlace[];
  lines: NearbyLine[];
}

function loadCache(): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(c: CacheShape) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

export async function findNearby(
  lat: number,
  lng: number,
  radius = 1000,
): Promise<{ places: NearbyPlace[]; lines: NearbyLine[]; fromCache: boolean }> {
  const cached = loadCache();
  if (cached && haversine({ latitude: cached.lat, longitude: cached.lng }, { latitude: lat, longitude: lng }) < 100) {
    return { ...cached, fromCache: true };
  }

  const places = await searchNearbyTransit({ lat, lng }, radius);

  // Cache de locais no Supabase (best-effort)
  databaseService.upsertTransportLocations(places).catch(() => {});

  // Buscar linhas que param em algum dos placeIds
  const lines = await databaseService.linesNearPlaces(places.map((p) => p.id));
  const enriched: NearbyLine[] = lines.map((l) => {
    const stop = places.find((p) => p.id === l.closestPlaceId);
    return {
      id: l.id,
      lineCode: l.lineCode,
      lineName: l.lineName,
      transportType: l.transportType,
      origin: l.origin,
      destination: l.destination,
      distanceMeters: stop?.distanceMeters ?? 0,
      closestStop: stop,
    };
  });
  enriched.sort((a, b) => a.distanceMeters - b.distanceMeters);

  const next: CacheShape = { ts: Date.now(), lat, lng, places, lines: enriched };
  saveCache(next);
  return { places, lines: enriched, fromCache: false };
}
