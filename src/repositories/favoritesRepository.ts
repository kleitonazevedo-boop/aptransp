import { getDb, newId, LOCAL_USER_ID } from "@/database/database";

export interface LocalFavoriteRoute {
  id?: string;
  user_id?: string;
  origem: string;
  destino: string;
  modo_transporte: string;
  distancia?: number | null;
  tempo_estimado?: number | null;
  created_at?: string;
}

export type FavoriteKind = "casa" | "trabalho" | "custom";

export interface LocalFavoritePlace {
  id?: string;
  user_id?: string;
  label: string;
  endereco: string;
  latitude?: number | null;
  longitude?: number | null;
  kind: FavoriteKind;
  created_at?: string;
}

export const favoritesRepository = {
  // ----- Rotas favoritas
  async addRoute(f: Omit<LocalFavoriteRoute, "id" | "user_id" | "created_at">): Promise<LocalFavoriteRoute> {
    const db = await getDb();
    const id = newId();
    await db.run(
      `INSERT INTO favorite_routes (id, user_id, origem, destino, modo_transporte, distancia, tempo_estimado)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [id, LOCAL_USER_ID, f.origem, f.destino, f.modo_transporte, f.distancia ?? null, f.tempo_estimado ?? null],
    );
    return { id, user_id: LOCAL_USER_ID, ...f };
  },

  async listRoutes(limit = 10): Promise<LocalFavoriteRoute[]> {
    const db = await getDb();
    return db.all<LocalFavoriteRoute>(
      `SELECT * FROM favorite_routes WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?;`,
      [LOCAL_USER_ID, limit],
    );
  },

  async removeRoute(id: string): Promise<void> {
    const db = await getDb();
    await db.run("DELETE FROM favorite_routes WHERE id = ?;", [id]);
  },

  // ----- Locais favoritos (origem/destino, casa, trabalho)
  async addPlace(p: Omit<LocalFavoritePlace, "id" | "user_id" | "created_at">): Promise<LocalFavoritePlace> {
    const db = await getDb();
    const id = newId();
    if (p.kind === "casa" || p.kind === "trabalho") {
      await db.run("DELETE FROM favorite_places WHERE user_id = ? AND kind = ?;", [LOCAL_USER_ID, p.kind]);
    }
    await db.run(
      `INSERT INTO favorite_places (id, user_id, label, endereco, latitude, longitude, kind)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [id, LOCAL_USER_ID, p.label, p.endereco, p.latitude ?? null, p.longitude ?? null, p.kind],
    );
    return { id, user_id: LOCAL_USER_ID, ...p };
  },

  async listPlaces(): Promise<LocalFavoritePlace[]> {
    const db = await getDb();
    return db.all<LocalFavoritePlace>(
      `SELECT * FROM favorite_places WHERE user_id = ? ORDER BY created_at DESC, rowid DESC;`,
      [LOCAL_USER_ID],
    );
  },

  async getPlaceByKind(kind: FavoriteKind): Promise<LocalFavoritePlace | null> {
    const db = await getDb();
    return db.one<LocalFavoritePlace>(
      "SELECT * FROM favorite_places WHERE user_id = ? AND kind = ? LIMIT 1;",
      [LOCAL_USER_ID, kind],
    );
  },

  async removePlace(id: string): Promise<void> {
    const db = await getDb();
    await db.run("DELETE FROM favorite_places WHERE id = ?;", [id]);
  },
};
