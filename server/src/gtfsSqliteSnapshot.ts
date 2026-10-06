import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import Cursor from "pg-cursor";
import type { PoolClient } from "pg";

const TABLES = [
  ["gtfs_agency", ["agency_id","agency_name","agency_url","agency_timezone"]],
  ["gtfs_calendar", ["service_id","monday","tuesday","wednesday","thursday","friday","saturday","sunday","start_date","end_date"]],
  ["gtfs_routes", ["route_id","agency_id","route_short_name","route_long_name","route_type","route_color"]],
  ["gtfs_stops", ["stop_id","stop_name","stop_desc","stop_lat","stop_lon"]],
  ["gtfs_trips", ["trip_id","route_id","service_id","trip_headsign","direction_id","shape_id"]],
  ["gtfs_stop_times", ["trip_id","arrival_time","departure_time","stop_id","stop_sequence"]],
  ["gtfs_shapes", ["shape_id","shape_pt_lat","shape_pt_lon","shape_pt_sequence"]],
  ["gtfs_frequencies", ["trip_id","start_time","end_time","headway_secs"]],
  ["gtfs_fare_attributes", ["fare_id","price","currency_type","payment_method","transfers","transfer_duration"]],
  ["gtfs_fare_rules", ["fare_id","route_id","origin_id","destination_id"]],
] as const;

function q(v: unknown) {
  if (v === null || v === undefined) return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function schemaSql() {
  return `
PRAGMA journal_mode=OFF;
PRAGMA synchronous=OFF;
PRAGMA temp_store=MEMORY;
BEGIN;
CREATE TABLE gtfs_agency (agency_id TEXT PRIMARY KEY, agency_name TEXT, agency_url TEXT, agency_timezone TEXT);
CREATE TABLE gtfs_calendar (service_id TEXT PRIMARY KEY, monday INTEGER, tuesday INTEGER, wednesday INTEGER, thursday INTEGER, friday INTEGER, saturday INTEGER, sunday INTEGER, start_date TEXT, end_date TEXT);
CREATE TABLE gtfs_routes (route_id TEXT PRIMARY KEY, agency_id TEXT, route_short_name TEXT, route_long_name TEXT, route_type INTEGER, route_color TEXT);
CREATE TABLE gtfs_stops (stop_id TEXT PRIMARY KEY, stop_name TEXT, stop_desc TEXT, stop_lat REAL, stop_lon REAL);
CREATE TABLE gtfs_trips (trip_id TEXT PRIMARY KEY, route_id TEXT, service_id TEXT, trip_headsign TEXT, direction_id INTEGER, shape_id TEXT);
CREATE TABLE gtfs_stop_times (trip_id TEXT, arrival_time TEXT, departure_time TEXT, stop_id TEXT, stop_sequence INTEGER);
CREATE TABLE gtfs_shapes (shape_id TEXT, shape_pt_lat REAL, shape_pt_lon REAL, shape_pt_sequence INTEGER);
CREATE TABLE gtfs_frequencies (trip_id TEXT, start_time TEXT, end_time TEXT, headway_secs INTEGER);
CREATE TABLE gtfs_fare_attributes (fare_id TEXT PRIMARY KEY, price REAL, currency_type TEXT, payment_method INTEGER, transfers INTEGER, transfer_duration INTEGER);
CREATE TABLE gtfs_fare_rules (fare_id TEXT, route_id TEXT, origin_id TEXT, destination_id TEXT);
`;
}

function indexesSql(version: string, totalRecords: number) {
  return `
CREATE INDEX idx_gtfs_stops_lat_lon ON gtfs_stops(stop_lat, stop_lon);
CREATE INDEX idx_gtfs_trips_route ON gtfs_trips(route_id);
CREATE INDEX idx_gtfs_trips_shape ON gtfs_trips(shape_id);
CREATE INDEX idx_gtfs_stop_times_trip ON gtfs_stop_times(trip_id, stop_sequence);
CREATE INDEX idx_gtfs_stop_times_stop ON gtfs_stop_times(stop_id);
CREATE INDEX idx_gtfs_shapes_shape ON gtfs_shapes(shape_id, shape_pt_sequence);
CREATE INDEX idx_gtfs_frequencies_trip ON gtfs_frequencies(trip_id);
CREATE TABLE gtfs_snapshot_metadata (id INTEGER PRIMARY KEY CHECK(id=1), version TEXT NOT NULL, total_records INTEGER NOT NULL, created_at TEXT NOT NULL);
INSERT INTO gtfs_snapshot_metadata VALUES (1, ${q(version)}, ${totalRecords}, datetime('now'));
COMMIT;
PRAGMA journal_mode=DELETE;
VACUUM;
`;
}

async function write(stream: NodeJS.WritableStream, data: string) {
  if (stream.write(data)) return;
  await new Promise<void>((resolve, reject) => {
    stream.once("drain", resolve);
    stream.once("error", reject);
  });
}

export async function createSqliteSnapshot(client: PoolClient, directory: string, version: string, totalRecords: number) {
  await mkdir(directory, { recursive: true });
  const target = path.join(directory, `gtfs-${version}.sqlite`);
  const temp = `${target}.tmp`;
  await unlink(temp).catch(() => undefined);
  await unlink(target).catch(() => undefined);

  const proc = spawn("sqlite3", [temp], { stdio: ["pipe", "ignore", "pipe"] });
  let stderr = "";
  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", chunk => { stderr += chunk; });

  try {
    await write(proc.stdin, schemaSql());
    for (const [table, columns] of TABLES) {
      const cursor = client.query(new Cursor(`SELECT ${columns.join(",")} FROM ${table}`));
      try {
        while (true) {
          const rows = await cursor.read(2000);
          if (!rows.length) break;
          let sql = "";
          for (const row of rows) {
            sql += `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(c => q((row as Record<string, unknown>)[c])).join(",")});\n`;
          }
          await write(proc.stdin, sql);
        }
      } finally {
        await cursor.close().catch(() => undefined);
      }
    }
    await write(proc.stdin, indexesSql(version, totalRecords));
    proc.stdin.end();
    const code = await new Promise<number | null>((resolve, reject) => {
      proc.once("error", reject);
      proc.once("close", resolve);
    });
    if (code !== 0) throw new Error(`sqlite3 exited with code ${code}: ${stderr.slice(-2000)}`);
    await rename(temp, target);
    return target;
  } catch (error) {
    proc.stdin.destroy();
    proc.kill();
    await unlink(temp).catch(() => undefined);
    await unlink(target).catch(() => undefined);
    throw error;
  }
}
