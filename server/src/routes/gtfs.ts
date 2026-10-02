import { Router } from "express";
import { pool } from "../db.js";

export const gtfsRouter = Router();

const GTFS_TABLES = [
  "gtfs_agency",
  "gtfs_calendar",
  "gtfs_fare_attributes",
  "gtfs_fare_rules",
  "gtfs_frequencies",
  "gtfs_routes",
  "gtfs_shapes",
  "gtfs_stop_times",
  "gtfs_stops",
  "gtfs_trips",
] as const;

gtfsRouter.get("/version", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT version, status, imported_at, published_at, total_records, notes
         FROM gtfs_versions
        WHERE status = 'published'
        ORDER BY published_at DESC NULLS LAST, id DESC
        LIMIT 1`,
    );
    const current = result.rows[0] ?? null;
    res.json({
      status: "ok",
      hasPublishedVersion: Boolean(current),
      version: current,
    });
  } catch (error) {
    console.error("[gtfs/version]", error);
    res.status(500).json({ status: "error", message: "Failed to read GTFS version" });
  }
});

gtfsRouter.get("/status", async (_req, res) => {
  try {
    const counts: Record<string, number> = {};
    let totalRecords = 0;

    for (const table of GTFS_TABLES) {
      const result = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}`);
      const count = Number(result.rows[0]?.count ?? 0);
      counts[table] = count;
      totalRecords += count;
    }

    const [versionResult, importResult] = await Promise.all([
      pool.query(
        `SELECT version, status, imported_at, published_at, total_records, notes
           FROM gtfs_versions
          ORDER BY id DESC
          LIMIT 1`,
      ),
      pool.query(
        `SELECT id, filename, table_name, status, rows_imported, rows_total,
                error_message, created_at, updated_at
           FROM gtfs_imports
          ORDER BY created_at DESC
          LIMIT 10`,
      ),
    ]);

    res.json({
      status: "ok",
      totalRecords,
      counts,
      latestVersion: versionResult.rows[0] ?? null,
      recentImports: importResult.rows,
    });
  } catch (error) {
    console.error("[gtfs/status]", error);
    res.status(500).json({ status: "error", message: "Failed to read GTFS status" });
  }
});
