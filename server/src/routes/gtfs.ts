import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { randomUUID } from "node:crypto";
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


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const IMPORT_MAP: Record<string, { table: string; columns: string[] }> = {
  "agency.txt": { table: "gtfs_agency", columns: ["agency_id","agency_name","agency_url","agency_timezone"] },
  "calendar.txt": { table: "gtfs_calendar", columns: ["service_id","monday","tuesday","wednesday","thursday","friday","saturday","sunday","start_date","end_date"] },
  "routes.txt": { table: "gtfs_routes", columns: ["route_id","agency_id","route_short_name","route_long_name","route_type","route_color"] },
  "stops.txt": { table: "gtfs_stops", columns: ["stop_id","stop_name","stop_desc","stop_lat","stop_lon"] },
  "trips.txt": { table: "gtfs_trips", columns: ["trip_id","route_id","service_id","trip_headsign","direction_id","shape_id"] },
  "stop_times.txt": { table: "gtfs_stop_times", columns: ["trip_id","arrival_time","departure_time","stop_id","stop_sequence"] },
  "shapes.txt": { table: "gtfs_shapes", columns: ["shape_id","shape_pt_lat","shape_pt_lon","shape_pt_sequence"] },
  "frequencies.txt": { table: "gtfs_frequencies", columns: ["trip_id","start_time","end_time","headway_secs"] },
  "fare_attributes.txt": { table: "gtfs_fare_attributes", columns: ["fare_id","price","currency_type","payment_method","transfers","transfer_duration"] },
  "fare_rules.txt": { table: "gtfs_fare_rules", columns: ["fare_id","route_id","origin_id","destination_id"] },
};

gtfsRouter.post("/import", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ status: "error", message: "Campo file é obrigatório" });

  const config = IMPORT_MAP[file.originalname.toLowerCase()];
  if (!config) return res.status(400).json({ status: "error", message: "Arquivo GTFS não suportado", file: file.originalname });

  const importId = randomUUID();
  const client = await pool.connect();
  try {
    await pool.query(
      `INSERT INTO gtfs_imports (id, filename, table_name, status) VALUES ($1,$2,$3,'running')`,
      [importId, file.originalname, config.table],
    );

    const rows = parse(file.buffer, { columns: true, skip_empty_lines: true, bom: true, trim: true, relax_column_count: true }) as Record<string,string>[];
    await client.query("BEGIN");
    await client.query(`TRUNCATE TABLE ${config.table}`);

    const batchSize = 500;
    let imported = 0;
    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const batch = rows.slice(offset, offset + batchSize);
      const values: unknown[] = [];
      const tuples = batch.map((row, rowIndex) => {
        const placeholders = config.columns.map((column, colIndex) => {
          values.push(row[column] === "" || row[column] === undefined ? null : row[column]);
          return `$${rowIndex * config.columns.length + colIndex + 1}`;
        });
        return `(${placeholders.join(",")})`;
      });
      await client.query(
        `INSERT INTO ${config.table} (${config.columns.join(",")}) VALUES ${tuples.join(",")}`,
        values,
      );
      imported += batch.length;
    }
    await client.query("COMMIT");
    await pool.query(
      `UPDATE gtfs_imports SET status='done', rows_imported=$2, rows_total=$2, updated_at=NOW() WHERE id=$1`,
      [importId, imported],
    );
    return res.json({ status: "ok", importId, file: file.originalname, table: config.table, rowsImported: imported });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[gtfs/import]", error);
    await pool.query(
      `UPDATE gtfs_imports SET status='error', error_message=$2, updated_at=NOW() WHERE id=$1`,
      [importId, error instanceof Error ? error.message : "Unknown error"],
    ).catch(() => undefined);
    return res.status(500).json({ status: "error", message: "Failed to import GTFS file", importId });
  } finally {
    client.release();
  }
});
