import { gtfsRepository, type NearbyGtfsLine, type NearbyStop } from "@/repositories/gtfsRepository";
import type { DeviceLocation } from "@/services/locationService";

export type NearbySearch = "lines" | "stops";

export class NearbyDataError extends Error {
  constructor(public readonly code: "INVALID_LOCATION" | "GTFS_NOT_INSTALLED", message: string) {
    super(message);
    this.name = "NearbyDataError";
  }
}

export async function queryNearbyTransit(
  location: DeviceLocation,
  search: NearbySearch,
  radiusMeters = search === "lines" ? 1000 : 1500,
): Promise<{ stops: NearbyStop[]; lines: NearbyGtfsLine[] }> {
  const { latitude, longitude } = location;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new NearbyDataError("INVALID_LOCATION", "O aparelho não retornou uma localização válida.");
  }

  const dataset = await gtfsRepository.validateDataset();
  if (!dataset.valid) {
    throw new NearbyDataError("GTFS_NOT_INSTALLED", "Base de transporte não instalada ou sem dados.");
  }

  // Nearby lookups intentionally use only the active local GTFS SQLite snapshot.
  const stops = await gtfsRepository.nearbyStops(latitude, longitude, radiusMeters);
  const lines = search === "lines"
    ? await gtfsRepository.nearbyLines(latitude, longitude, radiusMeters, 40, stops)
    : [];
  return { stops, lines };
}
