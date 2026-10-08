import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { getGoogleMapsDiagnostics, hasGoogleKey, loadGoogleMaps } from "./googleMapsService";
import { connectivityService } from "./connectivityService";
import { getDb } from "@/database/database";
import { gtfsRepository } from "@/repositories/gtfsRepository";
import { getApiBaseUrl } from "@/config/api";
import { checkLocationPermission } from "@/services/locationService";

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
  try {
    await loadGoogleMaps();
    const diagnostic = getGoogleMapsDiagnostics();
    return {
      key: "maps", label: "Google Maps",
      status: diagnostic.status === "auth-failure" ? "fail" : "unknown",
      detail: `SDK: ${diagnostic.status} · WebView: ${diagnostic.webViewOrigin} · chave configurada: sim · valide API/restrições no Google Cloud`,
    };
  } catch {
    const diagnostic = getGoogleMapsDiagnostics();
    return {
      key: "maps", label: "Google Maps", status: "fail",
      detail: `SDK: ${diagnostic.status} · WebView: ${diagnostic.webViewOrigin} · chave configurada: ${diagnostic.keyConfigured ? "sim" : "não"}`,
    };
  }
}

async function checkGps(): Promise<DiagnosticResult> {
  try {
    const permission = await checkLocationPermission();
    return {
      key: "gps", label: "GPS",
      status: permission.granted ? "ok" : permission.blocked ? "fail" : "unknown",
      detail: permission.granted
        ? "Permissão concedida; a posição será solicitada quando um recurso GPS for usado."
        : permission.blocked
          ? "Permissão bloqueada; habilite nas configurações do aplicativo."
          : "Aguardando solicitação em uma ação que use localização.",
    };
  } catch {
    return { key: "gps", label: "GPS", status: "unknown", detail: "Não foi possível consultar a permissão." };
  }
}

async function checkAndroidPerms(): Promise<DiagnosticResult> {
  try {
    const permission = await checkLocationPermission();
    return {
      key: "perms", label: "Permissões",
      status: permission.granted ? "ok" : permission.blocked ? "fail" : "unknown",
      detail: permission.granted ? "Localização durante o uso autorizada" : permission.blocked ? "Ative nas configurações do aplicativo" : permission.state,
    };
  } catch {
    return { key: "perms", label: "Permissões", status: "unknown", detail: "Estado indisponível" };
  }
}

export async function checkHomelab(): Promise<DiagnosticResult> {
  try { return checkApiConnection("homelab", "API APTRANSP", getApiBaseUrl() + "/health", false); }
  catch (error) { return { key: "homelab", label: "API APTRANSP", status: "fail", detail: error instanceof Error ? error.message : "URL da API inválida" }; }
}

export async function checkGtfsHealth(): Promise<DiagnosticResult> {
  try { return checkApiConnection("gtfs-health", "API GTFS Health", getApiBaseUrl() + "/health/database", true); }
  catch (error) { return { key: "gtfs-health", label: "API GTFS Health", status: "fail", detail: error instanceof Error ? error.message : "URL da API inválida" }; }
}

export async function checkGtfsPackage(): Promise<DiagnosticResult> {
  try { return checkApiConnection("gtfs-package", "Metadata GTFS", getApiBaseUrl() + "/api/v1/gtfs/sync/latest", true); }
  catch (error) { return { key: "gtfs-package", label: "Metadata GTFS", status: "fail", detail: error instanceof Error ? error.message : "URL da API inválida" }; }
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
  key: string, label: string, configuredUrl: string, includeResponse: boolean,
): Promise<DiagnosticResult> {
  const base = { key, label };
  let url: URL;
  try {
    url = new URL(configuredUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Protocolo inválido");
  } catch {
    return { ...base, status: "fail", detail: "Endereço da API inválido" };
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
