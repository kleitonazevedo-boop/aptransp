import { hasGoogleKey, loadGoogleMaps } from "./googleMapsService";
import { connectivityService } from "./connectivityService";
import { getDb } from "@/database/database";
import { gtfsRepository } from "@/repositories/gtfsRepository";

export type DiagnosticStatus = "ok" | "fail" | "unknown";

export interface DiagnosticResult {
  key: string;
  label: string;
  status: DiagnosticStatus;
  detail?: string;
}

async function checkConnectivity(): Promise<DiagnosticResult> {
  const online = connectivityService.isOnline();
  return {
    key: "net", label: "Conectividade", status: "ok",
    detail: online ? "ONLINE" : "OFFLINE (modo local)",
  };
}

async function checkLocalDb(): Promise<DiagnosticResult> {
  try {
    const db = await getDb();
    const row = await db.one<{ n: number }>("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table';");
    return { key: "sqlite", label: "Banco local (aptransp.db)", status: "ok", detail: `${row?.n ?? 0} tabelas` };
  } catch (e) {
    return { key: "sqlite", label: "Banco local (aptransp.db)", status: "fail", detail: String(e) };
  }
}

async function checkGtfs(): Promise<DiagnosticResult> {
  try {
    const counts = await gtfsRepository.counts();
    const stops = counts.gtfs_stops ?? 0;
    const routes = counts.gtfs_routes ?? 0;
    return {
      key: "gtfs", label: "Base GTFS offline",
      status: stops > 0 ? "ok" : "fail",
      detail: stops > 0 ? `${stops} paradas · ${routes} linhas` : "Importe os arquivos GTFS",
    };
  } catch (e) {
    return { key: "gtfs", label: "Base GTFS offline", status: "fail", detail: String(e) };
  }
}

async function checkGoogleMaps(): Promise<DiagnosticResult> {
  if (!connectivityService.isOnline()) {
    return { key: "maps", label: "Google Maps", status: "unknown", detail: "Offline" };
  }
  if (!hasGoogleKey()) return { key: "maps", label: "Google Maps", status: "fail", detail: "Sem VITE key" };
  try { await loadGoogleMaps(); return { key: "maps", label: "Google Maps", status: "ok" }; }
  catch (e) { return { key: "maps", label: "Google Maps", status: "fail", detail: String(e) }; }
}

async function checkGps(): Promise<DiagnosticResult> {
  if (!("geolocation" in navigator)) return { key: "gps", label: "GPS", status: "fail", detail: "API ausente" };
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ key: "gps", label: "GPS", status: "ok", detail: `acc ${Math.round(p.coords.accuracy)} m` }),
      (err) => resolve({ key: "gps", label: "GPS", status: "fail", detail: err.message }),
      { timeout: 8000 },
    );
  });
}

async function checkAndroidPerms(): Promise<DiagnosticResult> {
  try {
    const perm = await (navigator as Navigator & { permissions?: { query: (q: { name: PermissionName }) => Promise<PermissionStatus> } })
      .permissions?.query({ name: "geolocation" as PermissionName });
    if (!perm) return { key: "perms", label: "Permissões", status: "unknown" };
    return { key: "perms", label: "Permissões", status: perm.state === "granted" ? "ok" : "fail", detail: perm.state };
  } catch (e) { return { key: "perms", label: "Permissões", status: "unknown", detail: String(e) }; }
}

export const diagnosticsService = {
  async runAll(): Promise<DiagnosticResult[]> {
    return Promise.all([
      checkConnectivity(), checkLocalDb(), checkGtfs(),
      checkGoogleMaps(), checkGps(), checkAndroidPerms(),
    ]);
  },
};
