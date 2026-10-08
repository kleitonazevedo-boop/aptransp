export interface GtfsRemoteVersion {
  version: string;
  filename: string;
  size: number;
  sha256: string;
  downloadUrl: string;
  publishedAt: string | null;
  totalRecords: number;
}

export interface GtfsLocalVersion {
  version: string | null;
  status: string | null;
}

export interface GtfsSyncPort<TStaged> {
  readLocal(): Promise<GtfsLocalVersion>;
  isInstalledValid(version: string): Promise<boolean>;
  readRemote(): Promise<GtfsRemoteVersion>;
  download(remote: GtfsRemoteVersion, progress?: (percent: number) => void): Promise<TStaged>;
  validate(staged: TStaged, remote: GtfsRemoteVersion): Promise<void>;
  promote(staged: TStaged, remote: GtfsRemoteVersion): Promise<void>;
  discard(staged: TStaged): Promise<void>;
}

export type GtfsSyncResult =
  | { status: "current"; version: string }
  | { status: "offline"; version: string }
  | { status: "installed" | "updated"; version: string };

export async function synchronizeGtfs<TStaged>(
  port: GtfsSyncPort<TStaged>,
  onProgress?: (percent: number) => void,
): Promise<GtfsSyncResult> {
  const local = await port.readLocal();
  const localValid = local.version ? await port.isInstalledValid(local.version).catch(() => false) : false;
  let remote: GtfsRemoteVersion;

  try {
    remote = await port.readRemote();
  } catch (error) {
    if (localValid && local.version) return { status: "offline", version: local.version };
    throw error;
  }

  if (localValid && local.version === remote.version) {
    return { status: "current", version: remote.version };
  }

  let staged: TStaged | undefined;
  try {
    staged = await port.download(remote, onProgress);
    await port.validate(staged, remote);
    await port.promote(staged, remote);
    return { status: localValid ? "updated" : "installed", version: remote.version };
  } catch (error) {
    if (staged !== undefined) await port.discard(staged).catch(() => undefined);
    throw error;
  }
}

export interface GtfsSnapshotValidation {
  sizeBytes: number;
  sha256: string;
  integrity: string;
  tables: Record<string, number>;
}

export function assertGtfsSnapshotValid(
  remote: GtfsRemoteVersion,
  actual: GtfsSnapshotValidation,
): void {
  if (actual.sizeBytes !== remote.size) throw new Error("Tamanho da base GTFS não confere.");
  if (actual.sha256.toLowerCase() !== remote.sha256.toLowerCase()) throw new Error("SHA-256 da base GTFS não confere.");
  if (actual.integrity.toLowerCase() !== "ok") throw new Error("integrity_check do SQLite GTFS falhou.");
  for (const table of ["gtfs_stops", "gtfs_routes", "gtfs_trips", "gtfs_stop_times"]) {
    if (!Number.isFinite(actual.tables[table]) || actual.tables[table] <= 0) {
      throw new Error("Tabela GTFS essencial sem registros: " + table);
    }
  }
}
