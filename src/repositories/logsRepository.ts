import { getDb, newId, LOCAL_USER_ID } from "@/database/database";

export type LogLevel = "info" | "warn" | "error" | "debug";
export type LogSource = "google" | "gps" | "database" | "sptrans" | "gtfs" | "app";

export interface LocalSystemLog {
  id?: string;
  user_id?: string | null;
  level: LogLevel;
  source: LogSource;
  message: string;
  meta?: string | null;
  created_at?: string;
}

export const logsRepository = {
  async insert(level: LogLevel, source: LogSource, message: string, meta?: Record<string, unknown>) {
    const db = await getDb();
    await db.run(
      `INSERT INTO system_logs (id, user_id, level, source, message, meta) VALUES (?, ?, ?, ?, ?, ?);`,
      [newId(), LOCAL_USER_ID, level, source, message, meta ? JSON.stringify(meta) : null],
    );
  },

  async list(limit = 100): Promise<LocalSystemLog[]> {
    const db = await getDb();
    return db.all<LocalSystemLog>(
      "SELECT * FROM system_logs ORDER BY created_at DESC, rowid DESC LIMIT ?;",
      [limit],
    );
  },

  async clear(): Promise<void> {
    const db = await getDb();
    await db.run("DELETE FROM system_logs;");
  },
};
