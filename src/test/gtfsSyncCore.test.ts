import { describe, expect, it, vi } from "vitest";
import { assertGtfsSnapshotValid, synchronizeGtfs, type GtfsRemoteVersion, type GtfsSyncPort } from "@/services/gtfsSyncCore";

const remote: GtfsRemoteVersion = {
  version: "20261007-120000",
  filename: "aptransp_gtfs_20261007-120000.db",
  size: 100,
  sha256: "a".repeat(64),
  downloadUrl: "/api/v1/gtfs/sync/sqlite/20261007-120000",
  publishedAt: null,
  totalRecords: 10,
};

function port(options: {
  localVersion?: string | null;
  localValid?: boolean;
  remote?: GtfsRemoteVersion;
  remoteError?: Error;
  downloadError?: Error;
  validationError?: Error;
  promoteError?: Error;
} = {}) {
  const events: string[] = [];
  const adapter: GtfsSyncPort<string> = {
    readLocal: vi.fn(async () => ({ version: options.localVersion ?? null, status: options.localVersion ? "ready" : "idle" })),
    isInstalledValid: vi.fn(async () => options.localValid ?? false),
    readRemote: vi.fn(async () => {
      if (options.remoteError) throw options.remoteError;
      return options.remote ?? remote;
    }),
    download: vi.fn(async () => {
      events.push("download");
      if (options.downloadError) throw options.downloadError;
      return "staged";
    }),
    validate: vi.fn(async () => {
      events.push("validate");
      if (options.validationError) throw options.validationError;
    }),
    promote: vi.fn(async () => {
      events.push("promote");
      if (options.promoteError) throw options.promoteError;
    }),
    discard: vi.fn(async () => { events.push("discard"); }),
  };
  return { adapter, events };
}

describe("GTFS updater", () => {
  it("installs the first database only after it validates", async () => {
    const { adapter, events } = port();
    await expect(synchronizeGtfs(adapter)).resolves.toEqual({ status: "installed", version: remote.version });
    expect(events).toEqual(["download", "validate", "promote"]);
  });

  it("reports offline without a database as an error", async () => {
    const { adapter } = port({ remoteError: new Error("offline") });
    await expect(synchronizeGtfs(adapter)).rejects.toThrow("offline");
  });

  it("keeps an existing database usable when offline", async () => {
    const { adapter, events } = port({ localVersion: "20261006-010000", localValid: true, remoteError: new Error("offline") });
    await expect(synchronizeGtfs(adapter)).resolves.toEqual({ status: "offline", version: "20261006-010000" });
    expect(events).toEqual([]);
  });

  it("discards a staged file with a bad checksum or invalid SQLite structure", async () => {
    const { adapter, events } = port({ validationError: new Error("SHA-256 mismatch") });
    await expect(synchronizeGtfs(adapter)).rejects.toThrow("SHA-256 mismatch");
    expect(events).toEqual(["download", "validate", "discard"]);
    expect(adapter.promote).not.toHaveBeenCalled();
  });

  it("discards an interrupted download and never promotes it", async () => {
    const { adapter, events } = port({ downloadError: new Error("connection interrupted") });
    await expect(synchronizeGtfs(adapter)).rejects.toThrow("connection interrupted");
    expect(events).toEqual(["download"]);
    expect(adapter.promote).not.toHaveBeenCalled();
  });

  it("downloads an available update and retains the previous version until promotion", async () => {
    const { adapter, events } = port({ localVersion: "20261006-010000", localValid: true });
    await expect(synchronizeGtfs(adapter)).resolves.toEqual({ status: "updated", version: remote.version });
    expect(events.indexOf("validate")).toBeLessThan(events.indexOf("promote"));
  });

  it("does not redownload a valid current version", async () => {
    const { adapter, events } = port({ localVersion: remote.version, localValid: true });
    await expect(synchronizeGtfs(adapter)).resolves.toEqual({ status: "current", version: remote.version });
    expect(events).toEqual([]);
  });

  it("rolls back activation and leaves the previous version selected when promotion fails", async () => {
    const { adapter, events } = port({
      localVersion: "20261006-010000",
      localValid: true,
      promoteError: new Error("metadata swap failed"),
    });
    await expect(synchronizeGtfs(adapter)).rejects.toThrow("metadata swap failed");
    expect(events).toEqual(["download", "validate", "promote", "discard"]);
  });

  it("validates manifest size and digest before a database can be promoted", async () => {
    const { adapter } = port({ validationError: new Error("size mismatch") });
    await expect(synchronizeGtfs(adapter)).rejects.toThrow("size mismatch");
    expect(adapter.promote).not.toHaveBeenCalled();
  });

  it("does not mark a corrupt local database as current", async () => {
    const { adapter, events } = port({ localVersion: remote.version, localValid: false });
    await expect(synchronizeGtfs(adapter)).resolves.toEqual({ status: "installed", version: remote.version });
    expect(events).toEqual(["download", "validate", "promote"]);
  });

  it("keeps the old version active after a SQLite integrity failure", async () => {
    const { adapter, events } = port({
      localVersion: "20261006-010000",
      localValid: true,
      validationError: new Error("integrity_check failed"),
    });
    await expect(synchronizeGtfs(adapter)).rejects.toThrow("integrity_check failed");
    expect(events).toEqual(["download", "validate", "discard"]);
    expect(adapter.promote).not.toHaveBeenCalled();
  });
});

describe("validação de snapshot GTFS", () => {
  const actual = {
    sizeBytes: remote.size,
    sha256: remote.sha256,
    integrity: "ok",
    tables: { gtfs_stops: 2, gtfs_routes: 1, gtfs_trips: 3, gtfs_stop_times: 4 },
  };

  it("aceita somente tamanho, SHA, SQLite e tabelas essenciais válidos", () => {
    expect(() => assertGtfsSnapshotValid(remote, actual)).not.toThrow();
  });

  it("recusa tamanho ou SHA-256 divergentes", () => {
    expect(() => assertGtfsSnapshotValid(remote, { ...actual, sizeBytes: 99 })).toThrow("Tamanho");
    expect(() => assertGtfsSnapshotValid(remote, { ...actual, sha256: "b".repeat(64) })).toThrow("SHA-256");
  });

  it("recusa integridade SQLite inválida ou tabela essencial vazia", () => {
    expect(() => assertGtfsSnapshotValid(remote, { ...actual, integrity: "corrupt" })).toThrow("integrity_check");
    expect(() => assertGtfsSnapshotValid(remote, { ...actual, tables: { ...actual.tables, gtfs_trips: 0 } })).toThrow("gtfs_trips");
  });
});
