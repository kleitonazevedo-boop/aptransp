import { getDb, getGtfsSnapshotDb, newId, type LocalDb } from "@/database/database";

/** Arquivos GTFS suportados e mapeamento tabela/colunas. */
export const GTFS_FILE_MAP = {
  "agency.txt": { table: "gtfs_agency", columns: ["agency_id", "agency_name", "agency_url", "agency_timezone"] },
  "calendar.txt": {
    table: "gtfs_calendar",
    columns: ["service_id", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "start_date", "end_date"],
  },
  "routes.txt": {
    table: "gtfs_routes",
    columns: ["route_id", "agency_id", "route_short_name", "route_long_name", "route_type", "route_color"],
  },
  "shapes.txt": { table: "gtfs_shapes", columns: ["shape_id", "shape_pt_lat", "shape_pt_lon", "shape_pt_sequence"] },
  "stops.txt": { table: "gtfs_stops", columns: ["stop_id", "stop_name", "stop_desc", "stop_lat", "stop_lon"] },
  "stop_times.txt": {
    table: "gtfs_stop_times",
    columns: ["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"],
  },
  "trips.txt": {
    table: "gtfs_trips",
    columns: ["trip_id", "route_id", "service_id", "trip_headsign", "direction_id", "shape_id"],
  },
  "frequencies.txt": { table: "gtfs_frequencies", columns: ["trip_id", "start_time", "end_time", "headway_secs"] },
  "fare_attributes.txt": {
    table: "gtfs_fare_attributes",
    columns: ["fare_id", "price", "currency_type", "payment_method", "transfers", "transfer_duration"],
  },
  "fare_rules.txt": { table: "gtfs_fare_rules", columns: ["fare_id", "route_id", "origin_id", "destination_id"] },
} as const;

export type GtfsFileName = keyof typeof GTFS_FILE_MAP;
export const GTFS_FILES = Object.keys(GTFS_FILE_MAP) as GtfsFileName[];

export interface GtfsImportRow {
  id: string;
  filename: string;
  table_name?: string | null;
  status: "pending" | "running" | "done" | "error";
  rows_imported?: number | null;
  rows_total?: number | null;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GtfsSyncMetadata {
  id: number;
  version?: string | null;
  published_at?: string | null;
  total_records: number;
  package_sha256?: string | null;
  package_size_bytes?: number | null;
  status: "idle" | "checking" | "downloading" | "importing" | "ready" | "error";
  last_checked_at?: string | null;
  last_synced_at?: string | null;
  error_message?: string | null;
  updated_at?: string | null;
}

export interface NearbyStop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  distanceMeters: number;
}

export interface NearbyGtfsLine {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: string;
  stop_id: string;
  stop_name: string;
  distanceMeters: number;
}

/** CSV parser tolerante a aspas e vírgulas internas. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function haversineMeters(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const CHUNK = 400;

const REQUIRED_GTFS_TABLES = ["gtfs_stops", "gtfs_routes", "gtfs_trips", "gtfs_stop_times"] as const;
type RequiredGtfsTable = (typeof REQUIRED_GTFS_TABLES)[number];

export type GtfsDatasetStatus =
  | "valid"
  | "missing"
  | "invalid"
  | "snapshot-unavailable"
  | "database-unavailable"
  | "read-error";

export interface GtfsDatasetValidation {
  valid: boolean;
  status: GtfsDatasetStatus;
  source: "snapshot" | "legacy" | null;
  version: string | null;
  missingTables: string[];
  counts: Partial<Record<RequiredGtfsTable, number>>;
}

interface GtfsReadContext {
  db: LocalDb;
  key: string;
  source: "snapshot" | "legacy";
  version: string | null;
}

class ActiveSnapshotUnavailable extends Error {
  constructor(readonly version: string) {
    super("O snapshot GTFS ativo não está disponível.");
    this.name = "ActiveSnapshotUnavailable";
  }
}

let datasetValidationCache: { key: string; result: GtfsDatasetValidation } | null = null;

function invalidateDatasetValidation() {
  datasetValidationCache = null;
}

async function getGtfsReadContext(): Promise<GtfsReadContext> {
  const main = await getDb();
  const meta = await main.one<GtfsSyncMetadata>("SELECT * FROM gtfs_sync_metadata WHERE id = 1;");
  if (meta?.status === "ready" && meta.version) {
    try {
      const db = await getGtfsSnapshotDb(meta.version);
      return { db, key: `snapshot:${meta.version}`, source: "snapshot", version: meta.version };
    } catch {
      // A versão ativa não deve ser mascarada com dados legados possivelmente antigos.
      throw new ActiveSnapshotUnavailable(meta.version);
    }
  }
  return { db: main, key: "legacy", source: "legacy", version: null };
}

async function getGtfsReadDb(): Promise<LocalDb> {
  return (await getGtfsReadContext()).db;
}


export const gtfsRepository = {
  async getSyncMetadata(): Promise<GtfsSyncMetadata | null> {
    const db = await getDb();
    return db.one<GtfsSyncMetadata>("SELECT * FROM gtfs_sync_metadata WHERE id = 1;");
  },

  async setSyncStatus(
    status: GtfsSyncMetadata["status"],
    errorMessage: string | null = null,
  ): Promise<void> {
    const db = await getDb();
    await db.run(
      `UPDATE gtfs_sync_metadata
          SET status = ?, error_message = ?, updated_at = datetime('now')
        WHERE id = 1;`,
      [status, errorMessage],
    );
  },

  async markSyncChecked(): Promise<void> {
    const db = await getDb();
    await db.run(
      "UPDATE gtfs_sync_metadata SET last_checked_at = datetime('now'), updated_at = datetime('now') WHERE id = 1;",
    );
  },

  async activateSyncVersion(meta: {
    version: string;
    publishedAt: string | null;
    totalRecords: number;
    sha256: string;
    sizeBytes: number;
  }): Promise<void> {
    const db = await getDb();
    await db.run(
      `UPDATE gtfs_sync_metadata
          SET version = ?, published_at = ?, total_records = ?,
              package_sha256 = ?, package_size_bytes = ?, status = 'ready',
              last_checked_at = datetime('now'), last_synced_at = datetime('now'),
              error_message = NULL, updated_at = datetime('now')
        WHERE id = 1;`,
      [meta.version, meta.publishedAt, meta.totalRecords, meta.sha256, meta.sizeBytes],
    );
    invalidateDatasetValidation();
  },

  async listImports(): Promise<GtfsImportRow[]> {
    const db = await getDb();
    return db.all<GtfsImportRow>("SELECT * FROM gtfs_imports ORDER BY created_at DESC, rowid DESC LIMIT 50;");
  },

  async deleteImport(id: string): Promise<void> {
    const db = await getDb();
    await db.run("DELETE FROM gtfs_imports WHERE id = ?;", [id]);
  },

  async counts(): Promise<Record<string, number>> {
    const db = await getGtfsReadDb();
    const result: Record<string, number> = {};
    for (const { table } of Object.values(GTFS_FILE_MAP)) {
      const row = await db.one<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table};`);
      result[table] = Number(row?.n ?? 0);
    }
    return result;
  },

  async hasData(): Promise<boolean> {
    const db = await getGtfsReadDb();
    const row = await db.one<{ n: number }>("SELECT COUNT(*) AS n FROM gtfs_stops;");
    return Number(row?.n ?? 0) > 0;
  },

  /**
   * Validação estrutural leve do snapshot GTFS ativo.
   * O resultado é memorizado por versão; imports invalidam o cache.
   */
  async validateDataset(): Promise<GtfsDatasetValidation> {
    let context: GtfsReadContext;
    try {
      context = await getGtfsReadContext();
    } catch (error) {
      if (error instanceof ActiveSnapshotUnavailable) {
        return {
          valid: false, status: "snapshot-unavailable", source: "snapshot",
          version: error.version, missingTables: [], counts: {},
        };
      }
      return {
        valid: false, status: "database-unavailable", source: null,
        version: null, missingTables: [], counts: {},
      };
    }

    if (datasetValidationCache?.key === context.key) return datasetValidationCache.result;

    const base = {
      source: context.source,
      version: context.version,
    } as const;
    try {
      const rows = await context.db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table';",
      );
      const tables = new Set(rows.map((row) => row.name));
      const missingTables = REQUIRED_GTFS_TABLES.filter((table) => !tables.has(table));

      if (missingTables.length === REQUIRED_GTFS_TABLES.length) {
        const result: GtfsDatasetValidation = {
          ...base, valid: false, status: "missing", missingTables: [...missingTables], counts: {},
        };
        datasetValidationCache = { key: context.key, result };
        return result;
      }
      if (missingTables.length) {
        const result: GtfsDatasetValidation = {
          ...base, valid: false, status: "invalid", missingTables: [...missingTables], counts: {},
        };
        datasetValidationCache = { key: context.key, result };
        return result;
      }

      const counts: Partial<Record<RequiredGtfsTable, number>> = {};
      for (const table of REQUIRED_GTFS_TABLES) {
        const row = await context.db.one<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table};`);
        counts[table] = Number(row?.n ?? 0);
      }
      if (REQUIRED_GTFS_TABLES.some((table) => !counts[table])) {
        const result: GtfsDatasetValidation = {
          ...base, valid: false, status: "invalid", missingTables: [], counts,
        };
        datasetValidationCache = { key: context.key, result };
        return result;
      }

      const linkedRoute = await context.db.one<{ found: number }>(
        `SELECT 1 AS found
           FROM gtfs_stop_times st
           JOIN gtfs_trips t ON t.trip_id = st.trip_id
           JOIN gtfs_routes r ON r.route_id = t.route_id
           JOIN gtfs_stops s ON s.stop_id = st.stop_id
          LIMIT 1;`,
      );
      const result: GtfsDatasetValidation = {
        ...base,
        valid: Boolean(linkedRoute),
        status: linkedRoute ? "valid" : "invalid",
        missingTables: [],
        counts,
      };
      datasetValidationCache = { key: context.key, result };
      return result;
    } catch {
      // Erros transitórios de leitura não são memorizados para permitir nova tentativa.
      return {
        ...base, valid: false, status: "read-error", missingTables: [], counts: {},
      };
    }
  },

  /**
   * Importa um arquivo GTFS (.txt CSV) direto para o SQLite local, em blocos.
   * Nenhum upload é feito — o processamento é 100% no dispositivo.
   */
  async importFile(
    file: File,
    onProgress?: (imported: number, total: number) => void,
  ): Promise<GtfsImportRow> {
    const db = await getDb();
    const name = file.name as GtfsFileName;
    const spec = GTFS_FILE_MAP[name];
    const importId = newId();

    await db.run(
      "INSERT INTO gtfs_imports (id, filename, table_name, status) VALUES (?, ?, ?, 'running');",
      [importId, file.name, spec?.table ?? null],
    );

    const fail = async (msg: string) => {
      await db.run(
        "UPDATE gtfs_imports SET status = 'error', error_message = ?, updated_at = datetime('now') WHERE id = ?;",
        [msg, importId],
      );
      return (await db.one<GtfsImportRow>("SELECT * FROM gtfs_imports WHERE id = ?;", [importId]))!;
    };

    if (!spec) return fail(`Arquivo GTFS não suportado: ${file.name}`);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (!lines.length) return fail("Arquivo vazio");

      const header = parseCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, ""));
      const idx = spec.columns.map((c) => header.indexOf(c));
      const total = lines.length - 1;

      invalidateDatasetValidation();
      await db.run(`DELETE FROM ${spec.table};`);
      await db.run("UPDATE gtfs_imports SET rows_total = ? WHERE id = ?;", [total, importId]);

      const placeholders = spec.columns.map(() => "?").join(", ");
      const sql = `INSERT OR REPLACE INTO ${spec.table} (${spec.columns.join(", ")}) VALUES (${placeholders});`;

      let imported = 0;
      for (let start = 1; start < lines.length; start += CHUNK) {
        const batch: Array<{ sql: string; params: (string | number | null)[] }> = [];
        for (let i = start; i < Math.min(start + CHUNK, lines.length); i++) {
          const cells = parseCsvLine(lines[i]);
          batch.push({ sql, params: idx.map((j) => (j >= 0 ? (cells[j] ?? null) : null)) });
        }
        await db.transaction(batch);
        imported += batch.length;
        await db.run(
          "UPDATE gtfs_imports SET rows_imported = ?, updated_at = datetime('now') WHERE id = ?;",
          [imported, importId],
        );
        onProgress?.(imported, total);
      }

      await db.run("UPDATE gtfs_imports SET status = 'done', updated_at = datetime('now') WHERE id = ?;", [importId]);
      return (await db.one<GtfsImportRow>("SELECT * FROM gtfs_imports WHERE id = ?;", [importId]))!;
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },

  /**
   * Importa um pacote GTFS completo de forma atômica.
   * Todas as tabelas são substituídas dentro de uma única transação SQLite;
   * qualquer erro preserva integralmente a versão anterior.
   */
  async importPackageAtomic(
    files: Partial<Record<GtfsFileName, string>>,
    onProgress?: (file: GtfsFileName, imported: number, total: number) => void,
  ): Promise<Record<string, number>> {
    const required: GtfsFileName[] = ["agency.txt", "routes.txt", "stops.txt", "trips.txt", "stop_times.txt"];
    for (const name of required) {
      if (!files[name]) throw new Error(`Pacote GTFS incompleto: ${name} ausente`);
    }

    const db = await getDb();
    const counts: Record<string, number> = {};
    await db.beginTransaction();

    try {
      for (const name of GTFS_FILES) {
        const text = files[name];
        if (text == null) continue;
        const spec = GTFS_FILE_MAP[name];
        const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
        if (lines.length < 2) throw new Error(`Arquivo GTFS vazio: ${name}`);

        const header = parseCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, ""));
        const idx = spec.columns.map((column) => header.indexOf(column));
        const missing = spec.columns.filter((_, i) => idx[i] < 0);
        if (missing.length) throw new Error(`${name}: colunas ausentes: ${missing.join(", ")}`);

        await db.run(`DELETE FROM ${spec.table};`);
        const placeholders = spec.columns.map(() => "?").join(", ");
        const sql = `INSERT OR REPLACE INTO ${spec.table} (${spec.columns.join(", ")}) VALUES (${placeholders});`;
        const total = lines.length - 1;

        for (let offset = 1; offset < lines.length; offset += CHUNK) {
          const end = Math.min(offset + CHUNK, lines.length);
          const batch: Array<{ sql: string; params?: (string | number | null)[] }> = [];
          for (let i = offset; i < end; i++) {
            const cells = parseCsvLine(lines[i]);
            batch.push({ sql, params: idx.map((j) => cells[j] ?? null) });
          }
          await db.transaction(batch);
          onProgress?.(name, end - 1, total);
        }
        counts[spec.table] = total;
      }

      const stops = counts.gtfs_stops ?? 0;
      const routes = counts.gtfs_routes ?? 0;
      const trips = counts.gtfs_trips ?? 0;
      const stopTimes = counts.gtfs_stop_times ?? 0;
      if (!stops || !routes || !trips || !stopTimes) {
        throw new Error("Pacote GTFS inválido: tabelas essenciais sem registros");
      }

      await db.commitTransaction();
      invalidateDatasetValidation();
      return counts;
    } catch (error) {
      await db.rollbackTransaction();
      throw error;
    }
  },

  /** Paradas próximas — consulta offline com bounding box + haversine. */
  async nearbyStops(lat: number, lon: number, radiusMeters = 1000, limit = 30): Promise<NearbyStop[]> {
    const db = await getGtfsReadDb();
    const dLat = radiusMeters / 111_320;
    const dLon = radiusMeters / (111_320 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
    const rows = await db.all<{ stop_id: string; stop_name: string; stop_lat: number; stop_lon: number }>(
      `SELECT stop_id, stop_name, stop_lat, stop_lon FROM gtfs_stops
       WHERE stop_lat BETWEEN ? AND ? AND stop_lon BETWEEN ? AND ? LIMIT 800;`,
      [lat - dLat, lat + dLat, lon - dLon, lon + dLon],
    );
    return rows
      .map((r) => ({ ...r, distanceMeters: haversineMeters(lat, lon, Number(r.stop_lat), Number(r.stop_lon)) }))
      .filter((r) => r.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);
  },

  /** Linhas que atendem as paradas próximas — offline via stop_times/trips/routes. */
  async nearbyLines(
    lat: number,
    lon: number,
    radiusMeters = 1000,
    limit = 40,
    nearbyStops?: NearbyStop[],
  ): Promise<NearbyGtfsLine[]> {
    const stops: NearbyStop[] = nearbyStops ?? await this.nearbyStops(lat, lon, radiusMeters, 25);
    if (!stops.length) return [];
    const db = await getGtfsReadDb();
    const ids = stops.map((s) => s.stop_id);
    const inList = ids.map(() => "?").join(", ");
    const rows = await db.all<{
      route_id: string; route_short_name: string; route_long_name: string; route_type: string; stop_id: string;
    }>(
      `SELECT DISTINCT r.route_id, r.route_short_name, r.route_long_name, r.route_type, st.stop_id
         FROM gtfs_stop_times st
         JOIN gtfs_trips t ON t.trip_id = st.trip_id
         JOIN gtfs_routes r ON r.route_id = t.route_id
        WHERE st.stop_id IN (${inList})
        LIMIT 400;`,
      ids,
    );
    const byStop = new Map(stops.map((s) => [s.stop_id, s]));
    const seen = new Set<string>();
    const out: NearbyGtfsLine[] = [];
    for (const r of rows) {
      if (seen.has(r.route_id)) continue;
      seen.add(r.route_id);
      const s = byStop.get(r.stop_id);
      out.push({
        route_id: r.route_id,
        route_short_name: r.route_short_name ?? "",
        route_long_name: r.route_long_name ?? "",
        route_type: String(r.route_type ?? ""),
        stop_id: r.stop_id,
        stop_name: s?.stop_name ?? "",
        distanceMeters: s?.distanceMeters ?? 0,
      });
    }
    return out.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, limit);
  },

  /** Próximos horários programados de uma parada (offline, via stop_times). */
  async nextDepartures(stopId: string, limit = 8) {
    const db = await getGtfsReadDb();
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;
    return db.all<{ departure_time: string; route_short_name: string; trip_headsign: string }>(
      `SELECT st.departure_time, r.route_short_name, t.trip_headsign
         FROM gtfs_stop_times st
         JOIN gtfs_trips t ON t.trip_id = st.trip_id
         JOIN gtfs_routes r ON r.route_id = t.route_id
        WHERE st.stop_id = ? AND st.departure_time >= ?
        ORDER BY st.departure_time ASC LIMIT ?;`,
      [stopId, hhmm, limit],
    );
  },
};
