/**
 * Paradas e linhas próximas — 100% OFFLINE via GTFS local (SQLite).
 * Nenhuma chamada de rede é feita aqui.
 */
import { gtfsRepository, type NearbyStop } from "@/repositories/gtfsRepository";
import { databaseService, type DbLine } from "./databaseService";

export interface NearbyLine {
  id: string;
  lineCode: string;
  lineName: string;
  transportType: string;
  origin: string;
  destination: string;
  distanceMeters: number;
  stopName?: string;
}

export interface NearbyResult {
  stops: NearbyStop[];
  lines: NearbyLine[];
  hasGtfs: boolean;
}

export async function findNearby(lat: number, lng: number, radius = 1000): Promise<NearbyResult> {
  const hasGtfs = await gtfsRepository.hasData();
  if (!hasGtfs) return { stops: [], lines: [], hasGtfs: false };

  const [stops, lines] = await Promise.all([
    gtfsRepository.nearbyStops(lat, lng, radius),
    databaseService.linesNear(lat, lng, radius),
  ]);
  return { stops, lines: lines as DbLine[], hasGtfs: true };
}

export async function findNearbyStops(lat: number, lng: number, radius = 1500) {
  return gtfsRepository.nearbyStops(lat, lng, radius);
}

export async function nextDepartures(stopId: string) {
  return gtfsRepository.nextDepartures(stopId);
}
