/**
 * Importação GTFS 100% local: os arquivos .txt são lidos no dispositivo
 * e gravados diretamente no SQLite (aptransp.db). Sem upload.
 */
import { unzipSync, strFromU8 } from "fflate";
import { gtfsRepository, GTFS_FILES, type GtfsImportRow, type GtfsFileName, type GtfsSyncMetadata } from "@/repositories/gtfsRepository";

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
        !manifest.package?.sha256
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

      const response = await fetch(manifest.package.url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Download GTFS falhou (HTTP ${response.status})`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== manifest.package.sizeBytes) {
        throw new Error(`Tamanho do pacote inválido: esperado ${manifest.package.sizeBytes}, recebido ${bytes.byteLength}`);
      }

      onProgress?.("validating", "SHA-256");
      if (!globalThis.crypto?.subtle) throw new Error("SHA-256 indisponível neste dispositivo");
      const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      if (sha256.toLowerCase() !== manifest.package.sha256.toLowerCase()) {
        throw new Error("SHA-256 do pacote GTFS não confere");
      }

      onProgress?.("extracting", manifest.version);
      const zip = unzipSync(bytes);
      const files: Partial<Record<GtfsFileName, string>> = {};
      for (const name of GTFS_FILES) {
        const entry = zip[name];
        if (entry) files[name] = strFromU8(entry);
      }

      await gtfsRepository.setSyncStatus("importing");
      onProgress?.("importing", manifest.version);
      const counts = await gtfsRepository.importPackageAtomic(files, (file, done, total) => {
        onProgress?.("importing", `${file}: ${done}/${total}`);
      });
      const importedTotal = Object.values(counts).reduce((sum, n) => sum + n, 0);
      if (importedTotal !== manifest.totalRecords) {
        throw new Error(`Total GTFS divergente: manifesto ${manifest.totalRecords}, importado ${importedTotal}`);
      }

      await gtfsRepository.activateSyncVersion({
        version: manifest.version,
        publishedAt: manifest.publishedAt,
        totalRecords: manifest.totalRecords,
        sha256: manifest.package.sha256,
        sizeBytes: manifest.package.sizeBytes,
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
