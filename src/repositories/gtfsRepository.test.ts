import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalDb } from "@/database/database";

vi.mock("@/database/database", () => ({
  getDb: vi.fn(),
  getGtfsSnapshotDb: vi.fn(),
  newId: vi.fn(() => "test-id"),
}));

import { getDb, getGtfsSnapshotDb } from "@/database/database";
import { gtfsRepository, type NearbyStop } from "@/repositories/gtfsRepository";

const tables = ["gtfs_stops", "gtfs_routes", "gtfs_trips", "gtfs_stop_times"];
let activeVersion = "";
let readDb: LocalDb;
const mainDb = {
  one: vi.fn(),
} as unknown as LocalDb;

function makeSnapshotDb(options?: {
  tableNames?: string[];
  counts?: Record<string, number>;
  readError?: boolean;
  linkedRoute?: boolean;
  stops?: Array<Record<string, unknown>>;
  routes?: Array<Record<string, unknown>>;
}): LocalDb {
  const names = options?.tableNames ?? tables;
  const counts = options?.counts ?? Object.fromEntries(tables.map((table) => [table, 1]));
  return {
    all: vi.fn(async (sql: string) => {
      if (sql.includes("sqlite_master")) {
        if (options?.readError) throw new Error("sqlite read failure");
        return names.map((name) => ({ name }));
      }
      if (sql.includes("FROM gtfs_stops")) {
        if (options?.readError) throw new Error("sqlite read failure");
        return options?.stops ?? [{ stop_id: "s1", stop_name: "Terminal", stop_lat: -23.5, stop_lon: -46.6 }];
      }
      if (sql.includes("FROM gtfs_stop_times st")) return options?.routes ?? [{
        route_id: "r1", route_short_name: "10", route_long_name: "Centro", route_type: "3", stop_id: "s1",
      }];
      return [];
    }),
    one: vi.fn(async (sql: string) => {
      if (sql.includes("COUNT(*)")) {
        const table = tables.find((name) => sql.includes(name));
        return { n: table ? counts[table] ?? 0 : 0 };
      }
      if (sql.includes("SELECT 1 AS found")) {
        if (options?.readError) throw new Error("sqlite read failure");
        return options?.linkedRoute === false ? null : { found: 1 };
      }
      return null;
    }),
    run: vi.fn(),
    transaction: vi.fn(),
    beginTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn(),
  } as unknown as LocalDb;
}

let versionSequence = 0;
beforeEach(() => {
  vi.resetAllMocks();
  activeVersion = `test-${++versionSequence}`;
  vi.mocked(mainDb.one).mockResolvedValue({ status: "ready", version: activeVersion } as never);
  vi.mocked(getDb).mockResolvedValue(mainDb);
  readDb = makeSnapshotDb();
  vi.mocked(getGtfsSnapshotDb).mockResolvedValue(readDb);
});

describe("gtfsRepository.validateDataset", () => {
  it("validates a populated active snapshot and exposes a typed result", async () => {
    const result = await gtfsRepository.validateDataset();
    expect(typeof gtfsRepository.validateDataset).toBe("function");
    expect(result).toMatchObject({
      valid: true, status: "valid", source: "snapshot", version: activeVersion,
      counts: { gtfs_stops: 1, gtfs_routes: 1, gtfs_trips: 1, gtfs_stop_times: 1 },
    });
  });

  it("reports an unavailable active snapshot without falling back to the main database", async () => {
    vi.mocked(getGtfsSnapshotDb).mockRejectedValue(new Error("snapshot missing"));
    const result = await gtfsRepository.validateDataset();
    expect(result).toMatchObject({ valid: false, status: "snapshot-unavailable", version: activeVersion });
    expect(mainDb.one).toHaveBeenCalledOnce();
  });

  it("caches structural validation for the active snapshot", async () => {
    await gtfsRepository.validateDataset();
    await gtfsRepository.validateDataset();
    expect(readDb.all).toHaveBeenCalledTimes(1);
  });

  it("reports an absent GTFS schema", async () => {
    readDb = makeSnapshotDb({ tableNames: [] });
    vi.mocked(getGtfsSnapshotDb).mockResolvedValue(readDb);
    expect(await gtfsRepository.validateDataset()).toMatchObject({ valid: false, status: "missing" });
  });

  it("reports required tables missing from a partial schema", async () => {
    readDb = makeSnapshotDb({ tableNames: ["gtfs_stops", "gtfs_routes"] });
    vi.mocked(getGtfsSnapshotDb).mockResolvedValue(readDb);
    expect(await gtfsRepository.validateDataset()).toMatchObject({
      valid: false, status: "invalid", missingTables: ["gtfs_trips", "gtfs_stop_times"],
    });
  });

  it("rejects tables that exist but contain no GTFS records", async () => {
    readDb = makeSnapshotDb({ counts: Object.fromEntries(tables.map((table) => [table, 0])) });
    vi.mocked(getGtfsSnapshotDb).mockResolvedValue(readDb);
    expect(await gtfsRepository.validateDataset()).toMatchObject({ valid: false, status: "invalid" });
  });

  it("distinguishes SQLite read failures from an absent dataset", async () => {
    readDb = makeSnapshotDb({ readError: true });
    vi.mocked(getGtfsSnapshotDb).mockResolvedValue(readDb);
    expect(await gtfsRepository.validateDataset()).toMatchObject({ valid: false, status: "read-error" });
  });

  it("queries nearby stops from the active SQLite snapshot", async () => {
    const result = await gtfsRepository.nearbyStops(-23.5, -46.6, 1000);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ stop_id: "s1", distanceMeters: 0 });
  });

  it("queries nearby lines and can reuse the nearby stops already found", async () => {
    const stop: NearbyStop = {
      stop_id: "s1", stop_name: "Terminal", stop_lat: -23.5, stop_lon: -46.6, distanceMeters: 0,
    };
    const result = await gtfsRepository.nearbyLines(-23.5, -46.6, 1000, 40, [stop]);
    expect(result).toMatchObject([{ route_id: "r1", stop_id: "s1", route_short_name: "10" }]);
    expect(readDb.all).toHaveBeenCalledWith(expect.stringContaining("JOIN gtfs_trips"), ["s1"]);
  });
});
