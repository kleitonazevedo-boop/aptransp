import { getDb, newId, LOCAL_USER_ID } from "@/database/database";

export interface LocalHistoryItem {
  id?: string;
  user_id?: string;
  origem: string;
  destino: string;
  modo_transporte: string;
  distancia?: number | null;
  tempo_estimado?: number | null;
  created_at?: string;
}

export const historyRepository = {
  async push(h: Omit<LocalHistoryItem, "id" | "user_id" | "created_at">): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO route_history (id, user_id, origem, destino, modo_transporte, distancia, tempo_estimado)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [newId(), LOCAL_USER_ID, h.origem, h.destino, h.modo_transporte, h.distancia ?? null, h.tempo_estimado ?? null],
    );
  },

  async listRecent(limit = 5): Promise<LocalHistoryItem[]> {
    const db = await getDb();
    return db.all<LocalHistoryItem>(
      `SELECT * FROM route_history WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?;`,
      [LOCAL_USER_ID, limit],
    );
  },

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.run("DELETE FROM route_history WHERE id = ?;", [id]);
  },

  async clear(): Promise<void> {
    const db = await getDb();
    await db.run("DELETE FROM route_history WHERE user_id = ?;", [LOCAL_USER_ID]);
  },
};
