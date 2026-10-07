/**
 * Sincronização da base SQLite GTFS. As consultas de transporte continuam locais.
 */
import { Capacitor } from "@capacitor/core";
import { getApiBaseUrl } from "@/config/api";
import {
  downloadGtfsSnapshot,
  getGtfsSnapshotDb,
  hasGtfsSnapshot,
  hashGtfsSnapshot,
  removeGtfsSnapshot,
} from "@/database/database";
import { gtfsRepository, GTFS_FILES, type GtfsImportRow, type GtfsFileName, type GtfsSyncMetadata } from "@/repositories/gtfsRepository";
import { assertGtfsSnapshotValid, synchronizeGtfs, type GtfsRemoteVersion } from "@/services/gtfsSyncCore";

export { GTFS_FILES };
export type { GtfsFileName };
export type GtfsImport = GtfsImportRow;
export type { GtfsSyncMetadata };
export type GtfsSyncManifest = GtfsRemoteVersion;

const validatedSnapshotVersions = new Set<string>();

function parseLatest(payload: unknown): GtfsSyncManifest {
  const item = payload as Partial<GtfsSyncManifest>;
  if (
    !item || typeof item.version !== "string" || !item.version ||
    typeof item.filename !== "string" || !/^aptransp_gtfs_[a-zA-Z0-9._-]+\.db$/.test(item.filename) ||
    !Number.isSafeInteger(item.size) || Number(item.size) <= 0 ||
    typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(item.sha256) ||
    typeof item.downloadUrl !== "string" || !item.downloadUrl ||
    Number(item.totalRecords) <= 0 || item.filename !== "aptransp_gtfs_" + item.version + ".db"
  ) throw new Error("Metadata da base GTFS inválida.");
  const downloadUrl = new URL(item.downloadUrl, getApiBaseUrl() + "/");
  if (downloadUrl.origin !== new URL(getApiBaseUrl()).origin) {
    throw new Error("A URL do SQLite GTFS deve pertencer à API configurada.");
  }
  return { ...item, downloadUrl: downloadUrl.toString() } as GtfsSyncManifest;
}

async function fetchLatest(): Promise<GtfsSyncManifest> {
  const response = await fetch(getApiBaseUrl() + "/api/v1/gtfs/sync/latest", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Metadata GTFS indisponível (HTTP ${response.status}).`);
  return parseLatest(await response.json());
}

async function verifyWebSnapshotDownload(
  remote: GtfsSyncManifest,
  progress?: (percent: number) => void,
): Promise<void> {
  const response = await fetch(remote.downloadUrl, { cache: "force-cache" });
  if (!response.ok || !response.body) throw new Error(`Download GTFS falhou (HTTP ${response.status}).`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    received += value.byteLength;
    progress?.(Math.min(99, Math.floor((received / remote.size) * 100)));
  }
  if (received !== remote.size) throw new Error("Tamanho da base GTFS não confere.");
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (!globalThis.crypto?.subtle) throw new Error("SHA-256 indisponível neste navegador.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const valid = sha256.toLowerCase() === remote.sha256.toLowerCase();
  console.info("[GTFS-SYNC] SHA-256 valid: " + String(valid));
  console.info("[GTFS-SYNC] size bytes: " + received);
  if (!valid) throw new Error("SHA-256 da base GTFS não confere.");
  progress?.(100);
}

async function validateSnapshot(version: string, expected?: GtfsSyncManifest, verifyDigest = true): Promise<boolean> {
  const validationKey = version + ":" + (expected?.sha256 ?? "local");
  const snapshot = await getGtfsSnapshotDb(version);
  if (!verifyDigest && validatedSnapshotVersions.has(validationKey)) return true;
  const integrity = await snapshot.one<Record<string, unknown>>("PRAGMA integrity_check;");
  const integrityValue = String(integrity ? Object.values(integrity)[0] : "");
  console.info("[GTFS-SYNC] integrity_check: " + integrityValue);

  const metadataTable = await snapshot.one<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='gtfs_snapshot_metadata';",
  );
  if (metadataTable) {
    const metadata = await snapshot.one<{ version: string; total_records: number }>(
      "SELECT version, total_records FROM gtfs_snapshot_metadata WHERE id=1;",
    );
    if (!metadata || metadata.version !== version) throw new Error("Versão interna do snapshot GTFS inválida.");
    if (expected && Number(metadata.total_records) !== expected.totalRecords) {
      throw new Error("Contagem total do SQLite GTFS difere da metadata remota.");
    }
  }

  const specifications = [
    { key: "gtfs_stops", aliases: ["gtfs_stops", "stops"] },
    { key: "gtfs_routes", aliases: ["gtfs_routes", "routes"] },
    { key: "gtfs_trips", aliases: ["gtfs_trips", "trips"] },
    { key: "gtfs_stop_times", aliases: ["gtfs_stop_times", "stop_times"] },
  ];
  const tableCounts: Record<string, number> = {};
  for (const spec of specifications) {
    let count = 0;
    for (const table of spec.aliases) {
      const exists = await snapshot.one<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?;", [table],
      );
      if (!exists) continue;
      const result = await snapshot.one<{ n: number }>('SELECT COUNT(*) AS n FROM "' + table + '";');
      count = Math.max(count, Number(result?.n ?? 0));
    }
    tableCounts[spec.key] = count;
  }

  if (expected && verifyDigest) {
    const digest = !Capacitor.isNativePlatform()
      ? { sizeBytes: expected.size, sha256: expected.sha256 }
      : await hashGtfsSnapshot(version);
    const hashOk = digest.sha256.toLowerCase() === expected.sha256.toLowerCase();
    console.info("[GTFS-SYNC] SHA-256 valid: " + String(hashOk));
    console.info("[GTFS-SYNC] size bytes: " + digest.sizeBytes);
    assertGtfsSnapshotValid(expected, {
      ...digest,
      integrity: integrityValue,
      tables: tableCounts,
    });
  } else {
    if (integrityValue.toLowerCase() !== "ok") throw new Error("integrity_check do SQLite GTFS falhou.");
    for (const count of Object.values(tableCounts)) {
      if (count <= 0) throw new Error("Tabela GTFS essencial sem registros.");
    }
    if (expected) {
      console.info("[GTFS-SYNC] SHA-256 valid: previously validated");
      console.info("[GTFS-SYNC] size bytes: " + expected.size);
    }
  }
  validatedSnapshotVersions.add(validationKey);
  return true;
}

async function isLocalVersionValid(
  version: string,
  local: GtfsSyncMetadata | null,
): Promise<boolean> {
  if (version === "bundle") return (await gtfsRepository.validateDataset(true)).valid;
  if (!local || local.version !== version) return false;
  if (!(await hasGtfsSnapshot(version))) return (await gtfsRepository.validateDataset(true)).valid;
  if (
    !local.package_sha256 || !/^[a-f0-9]{64}$/i.test(local.package_sha256) ||
    !local.package_size_bytes || local.package_size_bytes <= 0 ||
    !local.total_records || local.total_records <= 0
  ) return false;
  try {
    return await validateSnapshot(version, {
      version,
      filename: "aptransp_gtfs_" + version + ".db",
      size: local.package_size_bytes,
      sha256: local.package_sha256,
      downloadUrl: "",
      publishedAt: local.published_at ?? null,
      totalRecords: local.total_records,
    }, false);
  } catch {
    return false;
  }
}

export const gtfsService = {
  async getSyncMetadata(): Promise<GtfsSyncMetadata | null> {
    try { return await gtfsRepository.getSyncMetadata(); }
    catch (error) { console.error("[GTFS-SYNC] Falha ao ler metadata local."); return null; }
  },

  async checkRemoteVersion(): Promise<{
    manifest: GtfsSyncManifest;
    local: GtfsSyncMetadata | null;
    updateAvailable: boolean;
  }> {
    const local = await gtfsRepository.getSyncMetadata();
    const localVersion = local?.version ?? "none";
    try {
      const manifest = await fetchLatest();
      const valid = local?.version
        ? await isLocalVersionValid(local.version, local)
        : (await gtfsRepository.validateDataset(true)).valid;
      console.info("[GTFS-SYNC] local version: " + localVersion);
      console.info("[GTFS-SYNC] remote version: " + manifest.version);
      console.info("[GTFS-SYNC] remote size bytes: " + manifest.size);
      return { manifest, local, updateAvailable: !valid || local?.version !== manifest.version };
    } catch (error) {
      console.info("[GTFS-SYNC] remote version: unavailable");
      throw error;
    }
  },

  async syncPublishedPackage(
    onProgress?: (stage: string, detail?: string) => void,
  ): Promise<{ updated: boolean; version: string; status: "offline" | "current" | "installed" | "updated" }> {
    await gtfsRepository.setSyncStatus("checking").catch(() => undefined);
    try {
      const result = await synchronizeGtfs({
        readLocal: async () => {
          const metadata = await gtfsRepository.getSyncMetadata();
          if (metadata?.version) return { version: metadata.version, status: metadata.status };
          const bundledOrLegacy = await gtfsRepository.validateDataset(true);
          return { version: bundledOrLegacy.valid ? "bundle" : null, status: bundledOrLegacy.valid ? "ready" : metadata?.status ?? null };
        },
        isInstalledValid: async (version) => isLocalVersionValid(version, await gtfsRepository.getSyncMetadata()),
        readRemote: fetchLatest,
        download: async (remote, reportProgress) => {
          console.info("[GTFS-SYNC] remote version: " + remote.version);
          console.info("[GTFS-SYNC] size bytes: " + remote.size);
          await gtfsRepository.setSyncStatus("downloading");
          onProgress?.("downloading", remote.version);
          try {
            if (!Capacitor.isNativePlatform()) {
              await verifyWebSnapshotDownload(remote, (percent) => {
                reportProgress?.(percent);
                onProgress?.("downloading", percent + "%");
              });
            }
            await downloadGtfsSnapshot(remote.downloadUrl);
            console.info("[GTFS-SYNC] progress: transfer complete");
            return remote;
          } catch (error) {
            await removeGtfsSnapshot(remote.version).catch(() => undefined);
            throw error;
          }
        },
        validate: async (remote) => {
          onProgress?.("validating", remote.version);
          await validateSnapshot(remote.version, remote);
        },
        promote: async (remote) => {
          onProgress?.("installing", remote.version);
          await gtfsRepository.activateSyncVersion({
            version: remote.version,
            publishedAt: remote.publishedAt,
            totalRecords: remote.totalRecords,
            sha256: remote.sha256,
            sizeBytes: remote.size,
          });
          console.info("[GTFS-SYNC] installation: active version switched");
        },
        discard: async (remote) => {
          await removeGtfsSnapshot(remote.version);
          console.info("[GTFS-SYNC] installation: staged version discarded");
        },
      }, (percent) => onProgress?.("downloading", String(percent)));

      if (result.status === "offline" || result.status === "current") {
        await gtfsRepository.setSyncStatus("ready");
        return { updated: false, version: result.version, status: result.status };
      }
      onProgress?.("ready", result.version);
      return { updated: true, version: result.version, status: result.status };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await gtfsRepository.setSyncStatus("error", message).catch(() => undefined);
      console.error("[GTFS-SYNC] installation: failed");
      throw error;
    }
  },

  async listImports(): Promise<GtfsImport[]> {
    try { return await gtfsRepository.listImports(); }
    catch (error) { console.error("[gtfs:list]", error); return []; }
  },
  async importFile(file: File, onProgress?: (done: number, total: number) => void): Promise<GtfsImport | null> {
    try { return await gtfsRepository.importFile(file, onProgress); }
    catch (error) { console.error("[gtfs:import]", error); return null; }
  },
  async deleteImport(id: string): Promise<boolean> {
    try { await gtfsRepository.deleteImport(id); return true; }
    catch (error) { console.error("[gtfs:del]", error); return false; }
  },
  async counts(): Promise<Record<string, number>> {
    try { return await gtfsRepository.counts(); }
    catch { return {}; }
  },
  async hasData(): Promise<boolean> {
    try { return await gtfsRepository.hasData(); }
    catch { return false; }
  },
  isNativePlatform: () => Capacitor.isNativePlatform(),
};
