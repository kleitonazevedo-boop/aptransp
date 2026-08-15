/**
 * Compatibilidade: antigo serviço de banco remoto, agora 100% local (SQLite).
 * Mantido para não quebrar consumidores existentes.
 */
import { getDb } from "@/database/database";
import { gtfsRepository, type NearbyGtfsLine } from "@/repositories/gtfsRepository";
import { favoritesRepository } from "@/repositories/favoritesRepository";
import { historyRepository } from "@/repositories/historyRepository";

export interface SavedRoute {
  id?: string;
  name?: string;
  origin: string;
  destination: string;
  created_at?: string;
}

export interface RouteHistoryEntry {
  origin: string;
  destination: string;
  distance: number;
  duration: number;
}

export interface DbLine {
  id: string;
  lineCode: string;
  lineName: string;
  transportType: string;
  origin: string;
  destination: string;
  distanceMeters: number;
  stopName?: string;
}

function toDbLine(l: NearbyGtfsLine): DbLine {
  return {
    id: l.route_id,
    lineCode: l.route_short_name || l.route_id,
    lineName: l.route_long_name || l.route_short_name,
    transportType: l.route_type === "3" ? "bus" : l.route_type === "1" ? "subway" : l.route_type === "2" ? "train" : "other",
    origin: (l.route_long_name || "").split(/\s*-\s*/)[0] ?? "",
    destination: (l.route_long_name || "").split(/\s*-\s*/)[1] ?? "",
    distanceMeters: l.distanceMeters,
    stopName: l.stop_name,
  };
}

export const databaseService = {
  async ping(): Promise<boolean> {
    try { await getDb(); return true; } catch { return false; }
  },

  async saveRoute(r: SavedRoute) {
    return favoritesRepository.addRoute({
      origem: r.origin, destino: r.destination, modo_transporte: "TRANSIT",
    });
  },

  async listSavedRoutes() {
    return favoritesRepository.listRoutes(20);
  },

  async pushHistory(h: RouteHistoryEntry) {
    await historyRepository.push({
      origem: h.origin, destino: h.destination, modo_transporte: "TRANSIT",
      distancia: h.distance, tempo_estimado: h.duration,
    });
  },

  /** Linhas próximas offline, direto do GTFS local. */
  async linesNear(lat: number, lng: number, radius = 1000): Promise<DbLine[]> {
    const lines = await gtfsRepository.nearbyLines(lat, lng, radius);
    return lines.map(toDbLine);
  },
};
