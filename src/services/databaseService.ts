import { supabase } from "@/integrations/supabase/client";
import type { NearbyPlace } from "./placesService";

export interface SavedRoute {
  id?: string;
  user_id?: string | null;
  name: string;
  origin: string;
  destination: string;
  created_at?: string;
}

export interface RouteHistoryEntry {
  id?: string;
  user_id?: string | null;
  origin: string;
  destination: string;
  distance: number;
  duration: number;
  created_at?: string;
}

export interface DbLine {
  id: string;
  lineCode: string;
  lineName: string;
  transportType: string;
  origin: string;
  destination: string;
  closestPlaceId?: string;
}

function logErr(scope: string, e: unknown) {
  console.error(`[db:${scope}]`, e);
}

export const databaseService = {
  async ping(): Promise<boolean> {
    try {
      const { error } = await supabase.from("transport_lines").select("id").limit(1);
      if (error) {
        logErr("ping", error.message);
        return false;
      }
      return true;
    } catch (e) {
      logErr("ping", e);
      return false;
    }
  },

  async saveRoute(r: SavedRoute): Promise<SavedRoute | null> {
    try {
      const { data, error } = await supabase.from("user_routes").insert(r).select().single();
      if (error) throw error;
      return data;
    } catch (e) {
      logErr("saveRoute", e);
      return null;
    }
  },

  async listSavedRoutes(): Promise<SavedRoute[]> {
    try {
      const { data, error } = await supabase
        .from("user_routes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    } catch (e) {
      logErr("listSavedRoutes", e);
      return [];
    }
  },

  async pushHistory(h: RouteHistoryEntry): Promise<void> {
    try {
      await supabase.from("route_history").insert(h);
    } catch (e) {
      logErr("pushHistory", e);
    }
  },

  async upsertTransportLocations(places: NearbyPlace[]): Promise<void> {
    if (!places.length) return;
    try {
      const rows = places.map((p) => ({
        google_place_id: p.id,
        name: p.name,
        type: p.type,
        latitude: p.latitude,
        longitude: p.longitude,
        address: p.address,
      }));
      await supabase.from("transport_locations").upsert(rows, { onConflict: "google_place_id" });
    } catch (e) {
      logErr("upsertTransportLocations", e);
    }
  },

  /**
   * Busca linhas que tenham paradas em algum dos placeIds informados.
   * Tabelas envolvidas: line_stops (stop_id = google_place_id), transport_lines.
   */
  async linesNearPlaces(placeIds: string[]): Promise<DbLine[]> {
    if (!placeIds.length) return [];
    try {
      const { data, error } = await supabase
        .from("line_stops")
        .select("stop_id, transport_lines(id,line_code,line_name,transport_type,origin,destination,active)")
        .in("stop_id", placeIds);
      if (error) throw error;
      const result: DbLine[] = [];
      const seen = new Set<string>();
      for (const row of (data ?? []) as unknown as Array<{
        stop_id: string;
        transport_lines: {
          id: string;
          line_code: string;
          line_name: string;
          transport_type: string;
          origin: string;
          destination: string;
          active: boolean;
        } | null;
      }>) {
        const l = row.transport_lines;
        if (!l || !l.active) continue;
        const key = `${l.id}-${row.stop_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          id: l.id,
          lineCode: l.line_code,
          lineName: l.line_name,
          transportType: l.transport_type,
          origin: l.origin,
          destination: l.destination,
          closestPlaceId: row.stop_id,
        });
      }
      return result;
    } catch (e) {
      logErr("linesNearPlaces", e);
      return [];
    }
  },

  async toggleFavoriteLine(lineId: string, currentlyFavorite: boolean): Promise<boolean> {
    try {
      if (currentlyFavorite) {
        const { error } = await supabase.from("favorite_lines").delete().eq("line_id", lineId);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase.from("favorite_lines").insert({ line_id: lineId });
      if (error) throw error;
      return true;
    } catch (e) {
      logErr("toggleFavoriteLine", e);
      return currentlyFavorite;
    }
  },

  async listFavoriteLines(): Promise<string[]> {
    try {
      const { data, error } = await supabase.from("favorite_lines").select("line_id");
      if (error) throw error;
      return (data ?? []).map((r) => r.line_id);
    } catch (e) {
      logErr("listFavoriteLines", e);
      return [];
    }
  },
};
