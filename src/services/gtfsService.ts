/**
 * Importação GTFS 100% local: os arquivos .txt são lidos no dispositivo
 * e gravados diretamente no SQLite (aptransp.db). Sem upload.
 */
import { gtfsRepository, GTFS_FILES, type GtfsImportRow, type GtfsFileName } from "@/repositories/gtfsRepository";

export { GTFS_FILES };
export type { GtfsFileName };
export type GtfsImport = GtfsImportRow;

export const gtfsService = {
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
