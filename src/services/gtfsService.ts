/**
 * Importação GTFS 100% local: os arquivos .txt são lidos no dispositivo
 * e gravados diretamente no SQLite (aptransp.db). Sem upload.
 */
import { gtfsRepository, GTFS_FILES, type GtfsImportRow, type GtfsFileName, type GtfsSyncMetadata } from "@/repositories/gtfsRepository";
import { downloadGtfsSnapshot, getGtfsSnapshotDb } from "@/database/database";

export { GTFS_FILES };
export type { GtfsFileName };
export type GtfsImport = GtfsImportRow;
export type { GtfsSyncMetadata };

export interface GtfsSyncManifest {
  status: "ok";
  version: string;
  publishedAt: string | null;
  totalRecords: number;
  package: {
    format: "zip";
    sizeBytes: number;
    sha256: string;
    url: string;
  };
  sqlite: {
    format: "sqlite";
    sizeBytes: number;
    sha256: string;
    url: string;
  };
}

const GTFS_API_BASE_URL = (import.meta.env.VITE_APTRANSP_API_URL as string | undefined)?.replace(/\/$/, "");

function apiBaseUrl(): string {
  if (!GTFS_API_BASE_URL) {
    throw new Error("VITE_APTRANSP_API_URL não configurada");
  }
  return GTFS_API_BASE_URL;
}

export const gtfsService = {
  async getSyncMetadata(): Promise<GtfsSyncMetadata | null> {
    try { return await gtfsRepository.getSyncMetadata(); }
    catch (e) { console.error("[gtfs:sync:metadata]", e); return null; }
  },

  async checkRemoteVersion(): Promise<{
    manifest: GtfsSyncManifest;
    local: GtfsSyncMetadata | null;
    updateAvailable: boolean;
  }> {
    await gtfsRepository.setSyncStatus("checking");
    try {
      const response = await fetch(`${apiBaseUrl()}/api/v1/gtfs/sync/manifest`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Manifesto GTFS indisponível (HTTP ${response.status})`);
      const manifest = await response.json() as GtfsSyncManifest;
      if (
        manifest.status !== "ok" ||
        !manifest.version ||
        manifest.package?.format !== "zip" ||
        !manifest.package?.url ||
        !manifest.package?.sha256 ||
        manifest.sqlite?.format !== "sqlite" ||
        !manifest.sqlite?.url ||
        !manifest.sqlite?.sha256
      ) {
        throw new Error("Manifesto GTFS inválido");
      }
      await gtfsRepository.markSyncChecked();
      const local = await gtfsRepository.getSyncMetadata();
      const updateAvailable = local?.version !== manifest.version || local?.status !== "ready";
      await gtfsRepository.setSyncStatus(local?.status === "ready" ? "ready" : "idle");
      return { manifest, local, updateAvailable };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await gtfsRepository.setSyncStatus("error", message);
      throw e;
    }
  },
  async syncPublishedPackage(
    onProgress?: (stage: string, detail?: string) => void,
  ): Promise<{ updated: boolean; version: string }> {
    const { manifest, updateAvailable } = await this.checkRemoteVersion();
    if (!updateAvailable) return { updated: false, version: manifest.version };

    try {
      await gtfsRepository.setSyncStatus("downloading");
      onProgress?.("downloading", manifest.version);

      // O plugin nativo grava o arquivo em streaming diretamente na pasta de
      // bancos SQLite. Não materializamos os ~68 MB no heap JavaScript.
      await downloadGtfsSnapshot(manifest.sqlite.url);

      onProgress?.("validating", "estrutura e metadados");
      const snapshot = await getGtfsSnapshotDb(manifest.version);
      const metadata = await snapshot.one<{ version: string; total_records: number }>(
        "SELECT version, total_records FROM gtfs_snapshot_metadata WHERE id=1;",
      );
      if (!metadata || metadata.version !== manifest.version) {
        throw new Error("Versão interna do snapshot GTFS não confere");
      }
      if (Number(metadata.total_records) !== manifest.totalRecords) {
        throw new Error(`Total GTFS divergente: manifesto ${manifest.totalRecords}, snapshot ${metadata.total_records}`);
      }

      const requiredTables = ["gtfs_agency","gtfs_routes","gtfs_stops","gtfs_trips","gtfs_stop_times"];
      for (const table of requiredTables) {
        const found = await snapshot.one<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?;",
          [table],
        );
        if (!found) throw new Error(`Tabela obrigatória ausente no snapshot: ${table}`);
      }

      await gtfsRepository.activateSyncVersion({
        version: manifest.version,
        publishedAt: manifest.publishedAt,
        totalRecords: manifest.totalRecords,
        sha256: manifest.sqlite.sha256,
        sizeBytes: manifest.sqlite.sizeBytes,
      });
      onProgress?.("ready", manifest.version);
      return { updated: true, version: manifest.version };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await gtfsRepository.setSyncStatus("error", message);
      throw e;
    }
  },

  async listImports(): Promise<GtfsImport[]> {
    try { return await gtfsRepository.listImports(); }
    catch (e) { console.error("[gtfs:list]", e); return []; }
  },

  async importFile(file: File, onProgress?: (done: number, total: number) => void): Promise<GtfsImport | null> {
    try { return await gtfsRepository.importFile(file, onProgress); }
    catch (e) { console.error("[gtfs:import]", e); return null; }
  },

  async deleteImport(id: string): Promise<boolean> {
    try { await gtfsRepository.deleteImport(id); return true; }
    catch (e) { console.error("[gtfs:del]", e); return false; }
  },

  async counts(): Promise<Record<string, number>> {
    try { return await gtfsRepository.counts(); }
    catch { return {}; }
  },

  async hasData(): Promise<boolean> {
    try { return await gtfsRepository.hasData(); }
    catch { return false; }
  },
};
