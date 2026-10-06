import { Capacitor, CapacitorHttp } from "@capacitor/core";
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

export async function checkHomelab(): Promise<DiagnosticResult> {
  return checkApiConnection("homelab", "Conexão homelab", "VITE_APTRANSP_API_URL", import.meta.env.VITE_APTRANSP_API_URL, false);
}

export async function checkGtfsHealth(): Promise<DiagnosticResult> {
  return checkApiConnection("gtfs-health", "API GTFS Health", "VITE_APTRANSP_API_HEALTH", import.meta.env.VITE_APTRANSP_API_HEALTH, true);
}

export async function checkGtfsPackage(): Promise<DiagnosticResult> {
  return checkApiConnection("gtfs-package", "API GTFS Package", "VITE_APTRANSP_API_PACK", import.meta.env.VITE_APTRANSP_API_PACK, true);
}

function formatResponse(data: unknown): string {
  if (typeof data === "string") {
    if (!data.length) return "Resposta vazia";
    try { return JSON.stringify(JSON.parse(data), null, 2); }
    catch { return data; }
  }
  return data == null ? "Resposta vazia" : JSON.stringify(data, null, 2);
}

async function checkApiConnection(
  key: string, label: string, envName: string, value: string | undefined, includeResponse: boolean,
): Promise<DiagnosticResult> {
  const base = { key, label };
  const configuredUrl = value?.trim();
  if (!configuredUrl) {
    return { ...base, status: "fail", detail: `${envName} não configurada` };
  }

  let url: URL;
  try {
    url = new URL(configuredUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Protocolo inválido");
  } catch {
    return { ...base, status: "fail", detail: key === "homelab" ? "Endereço homelab inválido" : `Endereço inválido em ${envName}` };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let status: number;
    let data: unknown;
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.get({
        url: url.href, connectTimeout: 8000, readTimeout: 8000,
        ...(includeResponse ? { responseType: "text" as const } : {}),
      });
      status = response.status;
      data = response.data;
    } else {
      const response = await fetch(url.href, { method: "GET", cache: "no-store", credentials: "omit", signal: controller.signal });
      status = response.status;
      if (includeResponse) data = await response.text();
    }
    // Homelab checks reachability; GTFS endpoints also validate HTTP success.
    return {
      ...base, status: !includeResponse || (status >= 200 && status < 300) ? "ok" : "fail",
      detail: includeResponse
        ? `HTTP ${status}\n${formatResponse(data)}`
        : `Servidor acessível · HTTP ${status}`,
    };
  } catch {
    return {
      ...base, status: "fail",
      detail: controller.signal.aborted
        ? "Sem resposta em 8 segundos"
        : "Não foi possível conectar: verifique rede, servidor e bloqueios de acesso (CORS/HTTP)",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const diagnosticsService = {
  async runAll(): Promise<DiagnosticResult[]> {
    return Promise.all([
      checkConnectivity(), checkLocalDb(), checkGtfs(),
      checkGoogleMaps(), checkGps(), checkAndroidPerms(), checkHomelab(),
      checkGtfsHealth(), checkGtfsPackage(),
    ]);
  },
};
