import { Capacitor } from "@capacitor/core";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

export type GoogleMapsLoadStatus =
  | "idle" | "loading" | "loaded" | "missing-key" | "auth-failure" | "load-error";

export interface GoogleMapsDiagnostics {
  keyConfigured: boolean;
  status: GoogleMapsLoadStatus;
  platform: string;
  webViewOrigin: string;
}

let loadStatus: GoogleMapsLoadStatus = apiKey ? "idle" : "missing-key";
let configured = false;
let bootPromise: Promise<void> | null = null;
let authCallbackInstalled = false;

function getWebViewOrigin(): string {
  if (typeof window === "undefined") return "unavailable";
  try { return new URL(window.location.href).origin; }
  catch { return "unavailable"; }
}

function installAuthFailureDiagnostic() {
  if (typeof window === "undefined" || authCallbackInstalled) return;
  authCallbackInstalled = true;
  (window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
    loadStatus = "auth-failure";
    console.error(
      "[GoogleMaps] Authentication failure. Check Maps JavaScript API enablement, billing, and API-key restrictions for this WebView origin.",
    );
  };
}

function ensureConfigured() {
  if (configured) return;
  setOptions({
    key: apiKey ?? "",
    v: "weekly",
    language: "pt-BR",
    region: "br",
    ...(channel ? { channel } : {}),
  });
  configured = true;
}

/** Carrega o Google Maps JS SDK (singleton) e devolve google.maps. */
export async function loadGoogleMaps(): Promise<typeof google.maps> {
  if (!apiKey) {
    loadStatus = "missing-key";
    console.error("[GoogleMaps] Browser key is not configured (value withheld).");
    throw new Error("Google Maps não está configurado neste build.");
  }

  ensureConfigured();
  installAuthFailureDiagnostic();
  if (!bootPromise) {
    loadStatus = "loading";
    console.info(
      `[GoogleMaps] Loading SDK; keyConfigured=true; platform=${Capacitor.getPlatform()}; webViewOrigin=${getWebViewOrigin()}`,
    );
    bootPromise = Promise.all([
      importLibrary("maps"),
      importLibrary("places"),
      importLibrary("routes"),
      importLibrary("geocoding"),
      importLibrary("marker"),
      importLibrary("geometry"),
    ]).then(() => {
      if (loadStatus !== "auth-failure") loadStatus = "loaded";
    }).catch(() => {
      loadStatus = "load-error";
      // Error messages from the loader can contain request details. Never echo them.
      console.error("[GoogleMaps] SDK load failed; request details withheld.");
      throw new Error("Não foi possível carregar o Google Maps.");
    });
  }
  await bootPromise;
  return google.maps;
}

export function hasGoogleKey(): boolean {
  return Boolean(apiKey);
}

/** Diagnóstico sem revelar o conteúdo da chave nem parâmetros de requisição. */
export function getGoogleMapsDiagnostics(): GoogleMapsDiagnostics {
  return {
    keyConfigured: Boolean(apiKey),
    status: loadStatus,
    platform: Capacitor.getPlatform(),
    webViewOrigin: getWebViewOrigin(),
  };
}
