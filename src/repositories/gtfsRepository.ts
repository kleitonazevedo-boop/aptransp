import { getDb, newId } from "@/database/database";

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

export const gtfsRepository = {
  async listImports(): Promise<GtfsImportRow[]> {
    const db = await getDb();
    return db.all<GtfsImportRow>("SELECT * FROM gtfs_imports ORDER BY created_at DESC, rowid DESC LIMIT 50;");
  },

  async deleteImport(id: string): Promise<void> {
    const db = await getDb();
    await db.run("DELETE FROM gtfs_imports WHERE id = ?;", [id]);
  },

  async counts(): Promise<Record<string, number>> {
    const db = await getDb();
    const result: Record<string, number> = {};
    for (const { table } of Object.values(GTFS_FILE_MAP)) {
      const row = await db.one<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table};`);
      result[table] = Number(row?.n ?? 0);
    }
    return result;
  },

  async hasData(): Promise<boolean> {
    const db = await getDb();
    const row = await db.one<{ n: number }>("SELECT COUNT(*) AS n FROM gtfs_stops;");
    return Number(row?.n ?? 0) > 0;
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

  /** Paradas próximas — consulta offline com bounding box + haversine. */
  async nearbyStops(lat: number, lon: number, radiusMeters = 1000, limit = 30): Promise<NearbyStop[]> {
    const db = await getDb();
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
  async nearbyLines(lat: number, lon: number, radiusMeters = 1000, limit = 40): Promise<NearbyGtfsLine[]> {
    const stops: NearbyStop[] = await this.nearbyStops(lat, lon, radiusMeters, 25);
    if (!stops.length) return [];
    const db = await getDb();
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
    const db = await getDb();
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
