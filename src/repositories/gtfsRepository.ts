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

async function getGtfsReadDb(): Promise<LocalDb> {
  const main = await getDb();
  const metadata = await main.one<GtfsSyncMetadata>("SELECT * FROM gtfs_sync_metadata WHERE id = 1;");
  if (metadata?.version) {
    try { return await getGtfsSnapshotDb(metadata.version); }
    catch {
      console.warn("[GTFS-DB] Snapshot ativo indisponível; consultando GTFS legado local.");
    }
  }
  return main;
}

const CHUNK = 400;

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
    verifiedSnapshotVersions.add(meta.version);
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
    const schema = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table';");
    const available = new Set(schema.map((row) => row.name));
    const dataset = await this.validateDataset();
    const result: Record<string, number> = {};
    for (const { table } of Object.values(GTFS_FILE_MAP)) {
      const key = table.replace(/^gtfs_/, "");
      const candidates = [dataset.tables[key], table, key].filter((name): name is string => Boolean(name));
      const selected = candidates.find((name) => available.has(name));
      if (!selected) {
        result[table] = 0;
        continue;
      }
      const row = await db.one<{ n: number }>('SELECT COUNT(*) AS n FROM "' + selected + '";');
      result[table] = Number(row?.n ?? 0);
    }
    return result;
  },

  async validateDataset(useLegacyDatabase = false): Promise<{ valid: boolean; counts: Record<string, number>; tables: Record<string, string | null> }> {
    const db = useLegacyDatabase ? await getDb() : await getGtfsReadDb();
    const schema = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table';");
    const available = new Set(schema.map((row) => row.name));
    const specs = [
      { key: "stops", candidates: ["gtfs_stops", "stops"] },
      { key: "routes", candidates: ["gtfs_routes", "routes"] },
      { key: "trips", candidates: ["gtfs_trips", "trips"] },
      { key: "stop_times", candidates: ["gtfs_stop_times", "stop_times"] },
      { key: "shapes", candidates: ["gtfs_shapes", "shapes"] },
    ];
    const counts: Record<string, number> = {};
    const tables: Record<string, string | null> = {};

    for (const spec of specs) {
      const found = spec.candidates.filter((name) => available.has(name));
      if (!found.length) {
        tables[spec.key] = null;
        counts[spec.key] = 0;
        console.warn("[GTFS-DB] " + spec.key + ": table missing");
        continue;
      }
      let selected = found[0];
      let selectedCount = -1;
      for (const table of found) {
        const row = await db.one<{ n: number }>('SELECT COUNT(*) AS n FROM "' + table + '";');
        const count = Number(row?.n ?? 0);
        if (count > selectedCount) {
          selected = table;
          selectedCount = count;
        }
      }
      tables[spec.key] = selected;
      counts[spec.key] = Math.max(0, selectedCount);
      console.info("[GTFS-DB] " + spec.key + ": " + counts[spec.key] + " (table " + selected + ")");
    }

    const required = ["stops", "routes", "trips", "stop_times"];
    const missing = required.filter((key) => !tables[key] || counts[key] === 0);
    const valid = missing.length === 0;
    if (!valid) {
      console.warn("[GTFS-DB] Base GTFS local não instalada ou sem dados. Ausentes/vazias: " + missing.join(", "));
    }
    return { valid, counts, tables };
  },

  async hasData(): Promise<boolean> {
    const status = await this.validateDataset();
    return status.valid;
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

    const statements: Array<{ sql: string; params?: (string | number | null)[] }> = [];
    const counts: Record<string, number> = {};

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

      statements.push({ sql: `DELETE FROM ${spec.table};` });
      const placeholders = spec.columns.map(() => "?").join(", ");
      const sql = `INSERT OR REPLACE INTO ${spec.table} (${spec.columns.join(", ")}) VALUES (${placeholders});`;

      const total = lines.length - 1;
      for (let i = 1; i < lines.length; i++) {
        const cells = parseCsvLine(lines[i]);
        statements.push({ sql, params: idx.map((j) => cells[j] ?? null) });
        if (i % 5000 === 0) onProgress?.(name, i, total);
      }
      counts[spec.table] = total;
      onProgress?.(name, total, total);
    }

    const stops = counts.gtfs_stops ?? 0;
    const routes = counts.gtfs_routes ?? 0;
    const trips = counts.gtfs_trips ?? 0;
    const stopTimes = counts.gtfs_stop_times ?? 0;
    if (!stops || !routes || !trips || !stopTimes) {
      throw new Error("Pacote GTFS inválido: tabelas essenciais sem registros");
    }

    const db = await getDb();
    await db.transaction(statements);
    return counts;
  },

  /** Paradas próximas — diagnóstico offline com bounding box + haversine. */
  async nearbyStops(lat: number, lon: number, radiusMeters = 1000, limit = 30): Promise<NearbyStop[]> {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error("Localização inválida: coordenadas GPS ausentes ou fora do intervalo.");
    }
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
      throw new Error("Raio de busca inválido.");
    }

    const db = await getGtfsReadDb();
    const status = await this.validateDataset();
    const table = status.tables.stops;
    if (!table || status.counts.stops === 0) throw new Error("Base GTFS local não instalada ou sem dados.");

    const dLat = radiusMeters / 111_320;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const dLon = radiusMeters / (111_320 * Math.max(0.1, Math.abs(cosLat)));
    const minLat = Math.max(-90, lat - dLat);
    const maxLat = Math.min(90, lat + dLat);
    const minLon = Math.max(-180, lon - dLon);
    const maxLon = Math.min(180, lon + dLon);
    console.info("[GTFS-NEARBY] latitude: " + lat);
    console.info("[GTFS-NEARBY] longitude: " + lon);
    console.info("[GTFS-NEARBY] radius: " + radiusMeters + " m");
    console.info("[GTFS-NEARBY] total stops: " + status.counts.stops);

    const rows = await db.all<{ stop_id: string; stop_name: string; stop_lat: number | string; stop_lon: number | string }>(
      'SELECT stop_id, stop_name, stop_lat, stop_lon FROM "' + table + '" ' +
      "WHERE CAST(stop_lat AS REAL) BETWEEN ? AND ? AND CAST(stop_lon AS REAL) BETWEEN ? AND ?;",
      [minLat, maxLat, minLon, maxLon],
    );
    console.info("[GTFS-NEARBY] stops in bbox: " + rows.length);

    const validRows = rows.filter((row) => {
      const stopLat = Number(row.stop_lat);
      const stopLon = Number(row.stop_lon);
      return Number.isFinite(stopLat) && Number.isFinite(stopLon) &&
        stopLat >= -90 && stopLat <= 90 && stopLon >= -180 && stopLon <= 180;
    });
    console.info("[GTFS-NEARBY] valid numeric-coordinate stops in bbox: " + validRows.length);
    if (validRows.length) {
      const sample = validRows.slice(0, 3);
      console.info("[GTFS-NEARBY] coordinate sample (lat,lon): " +
        sample.map((row) => Number(row.stop_lat) + "," + Number(row.stop_lon)).join(" | "));
    }

    const withinRadius = validRows
      .map((row) => ({
        ...row,
        stop_lat: Number(row.stop_lat),
        stop_lon: Number(row.stop_lon),
        distanceMeters: haversineMeters(lat, lon, Number(row.stop_lat), Number(row.stop_lon)),
      }))
      .filter((row) => row.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
    console.info("[GTFS-NEARBY] stops in radius: " + withinRadius.length);
    console.info("[GTFS-NEARBY] nearest stop distance: " +
      (withinRadius.length ? Math.round(withinRadius[0].distanceMeters) + " m" : "none"));

    return withinRadius.slice(0, limit);
  },

  /** Linhas que atendem as paradas próximas — offline via stop_times/trips/routes. */
  async nearbyLines(
    lat: number,
    lon: number,
    radiusMeters = 1000,
    limit = 40,
    nearbyStops?: NearbyStop[],
  ): Promise<NearbyGtfsLine[]> {
    const status = await this.validateDataset();
    if (!status.valid) throw new Error("Base GTFS local não instalada ou sem dados.");
    const stops = nearbyStops ?? await this.nearbyStops(lat, lon, radiusMeters, 25);
    if (!stops.length) {
      console.info("[GTFS-NEARBY] stop_times matched: 0 (no nearby stops)");
      console.info("[GTFS-NEARBY] distinct trips referenced: 0");
      console.info("[GTFS-NEARBY] trips matched: 0");
      console.info("[GTFS-NEARBY] distinct routes referenced: 0");
      console.info("[GTFS-NEARBY] routes found: 0");
      return [];
    }

    const db = await getGtfsReadDb();
    const stopTable = status.tables.stop_times!;
    const tripTable = status.tables.trips!;
    const routeTable = status.tables.routes!;
    const ids = stops.map((stop) => stop.stop_id);
    const inList = ids.map(() => "?").join(", ");
    const stopTimesCount = await db.one<{ n: number }>(
      'SELECT COUNT(*) AS n FROM "' + stopTable + '" WHERE stop_id IN (' + inList + ');',
      ids,
    );
    const tripsReferenced = await db.one<{ n: number }>(
      'SELECT COUNT(DISTINCT trip_id) AS n FROM "' + stopTable + '" WHERE stop_id IN (' + inList + ');',
      ids,
    );
    const tripsMatched = await db.one<{ n: number }>(
      'SELECT COUNT(DISTINCT st.trip_id) AS n FROM "' + stopTable + '" st ' +
      'JOIN "' + tripTable + '" t ON t.trip_id = st.trip_id WHERE st.stop_id IN (' + inList + ');',
      ids,
    );
    const routesReferenced = await db.one<{ n: number }>(
      'SELECT COUNT(DISTINCT t.route_id) AS n FROM "' + stopTable + '" st ' +
      'JOIN "' + tripTable + '" t ON t.trip_id = st.trip_id WHERE st.stop_id IN (' + inList + ');',
      ids,
    );
    const routesFound = await db.one<{ n: number }>(
      'SELECT COUNT(DISTINCT r.route_id) AS n FROM "' + stopTable + '" st ' +
      'JOIN "' + tripTable + '" t ON t.trip_id = st.trip_id ' +
      'JOIN "' + routeTable + '" r ON r.route_id = t.route_id WHERE st.stop_id IN (' + inList + ');',
      ids,
    );
    console.info("[GTFS-NEARBY] stop_times matched: " + Number(stopTimesCount?.n ?? 0));
    console.info("[GTFS-NEARBY] distinct trips referenced: " + Number(tripsReferenced?.n ?? 0));
    console.info("[GTFS-NEARBY] trips matched: " + Number(tripsMatched?.n ?? 0));
    console.info("[GTFS-NEARBY] distinct routes referenced: " + Number(routesReferenced?.n ?? 0));
    console.info("[GTFS-NEARBY] routes found: " + Number(routesFound?.n ?? 0));

    const rows = await db.all<{
      route_id: string; route_short_name: string; route_long_name: string; route_type: string; stop_id: string;
    }>(
      'SELECT DISTINCT r.route_id, r.route_short_name, r.route_long_name, r.route_type, st.stop_id ' +
      'FROM "' + stopTable + '" st JOIN "' + tripTable + '" t ON t.trip_id = st.trip_id ' +
      'JOIN "' + routeTable + '" r ON r.route_id = t.route_id ' +
      'WHERE st.stop_id IN (' + inList + ') LIMIT 400;',
      ids,
    );
    const byStop = new Map(stops.map((stop) => [stop.stop_id, stop]));
    const seen = new Set<string>();
    const result: NearbyGtfsLine[] = [];
    for (const row of rows) {
      if (seen.has(row.route_id)) continue;
      const stop = byStop.get(row.stop_id);
      if (!stop) continue;
      seen.add(row.route_id);
      result.push({
        route_id: row.route_id,
        route_short_name: row.route_short_name ?? "",
        route_long_name: row.route_long_name ?? "",
        route_type: String(row.route_type ?? ""),
        stop_id: row.stop_id,
        stop_name: stop.stop_name ?? "",
        distanceMeters: stop.distanceMeters,
      });
    }
    return result.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, limit);
  },

  /** Próximos horários programados de uma parada (offline, via stop_times). */
  async nextDepartures(stopId: string, limit = 8) {
    const db = await getGtfsReadDb();
    const tables = (await this.validateDataset()).tables;
    const stopTimes = tables.stop_times;
    const trips = tables.trips;
    const routes = tables.routes;
    if (!stopTimes || !trips || !routes) throw new Error("Base GTFS local não instalada ou sem dados.");
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;
    return db.all<{ departure_time: string; route_short_name: string; trip_headsign: string }>(
      `SELECT st.departure_time, r.route_short_name, t.trip_headsign
         FROM "${stopTimes}" st
         JOIN "${trips}" t ON t.trip_id = st.trip_id
         JOIN "${routes}" r ON r.route_id = t.route_id
        WHERE st.stop_id = ? AND st.departure_time >= ?
        ORDER BY st.departure_time ASC LIMIT ?;`,
      [stopId, hhmm, limit],
    );
  },
};
