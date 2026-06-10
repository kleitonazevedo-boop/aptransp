import { supabase } from "@/integrations/supabase/client";
import { hasGoogleKey, loadGoogleMaps } from "./googleMapsService";
import { sptransService } from "./sptransService";

export type DiagnosticStatus = "ok" | "fail" | "unknown";

export interface DiagnosticResult {
  key: string;
  label: string;
  status: DiagnosticStatus;
  detail?: string;
}

async function checkGoogleMaps(): Promise<DiagnosticResult> {
  if (!hasGoogleKey()) return { key: "maps", label: "Google Maps", status: "fail", detail: "Sem VITE key" };
  try { await loadGoogleMaps(); return { key: "maps", label: "Google Maps", status: "ok" }; }
  catch (e) { return { key: "maps", label: "Google Maps", status: "fail", detail: String(e) }; }
}

async function checkPlaces(): Promise<DiagnosticResult> {
  try {
    const url = "https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText";
    const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_API_KEY;
    const lov = import.meta.env.VITE_LOVABLE_API_KEY;
    if (!apiKey || !lov) return { key: "places", label: "Places API", status: "unknown", detail: "Gateway via backend" };
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": apiKey,
        "Content-Type": "application/json", "X-Goog-FieldMask": "places.id",
      },
      body: JSON.stringify({ textQuery: "Sé, São Paulo" }),
    });
    return { key: "places", label: "Places API", status: r.ok ? "ok" : "fail", detail: `HTTP ${r.status}` };
  } catch (e) { return { key: "places", label: "Places API", status: "fail", detail: String(e) }; }
}

async function checkRoutes(): Promise<DiagnosticResult> {
  return { key: "routes", label: "Routes API", status: "unknown", detail: "Validado em /traçar rota" };
}

async function checkGeocoding(): Promise<DiagnosticResult> {
  return { key: "geocoding", label: "Geocoding API", status: "unknown", detail: "Validado em /GPS" };
}

async function checkSupabase(): Promise<DiagnosticResult> {
  try {
    const { error } = await supabase.from("user_profile").select("id").limit(1);
    return { key: "supabase", label: "Supabase", status: error ? "fail" : "ok", detail: error?.message };
  } catch (e) { return { key: "supabase", label: "Supabase", status: "fail", detail: String(e) }; }
}

async function checkSptrans(): Promise<DiagnosticResult> {
  try {
    const lines = await sptransService.searchLines("8000");
    const ok = Array.isArray(lines);
    return { key: "sptrans", label: "SPTrans", status: ok ? "ok" : "fail", detail: ok ? `${lines.length} linhas` : "resposta inválida" };
  } catch (e) { return { key: "sptrans", label: "SPTrans", status: "fail", detail: String(e) }; }
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
      checkGoogleMaps(), checkPlaces(), checkRoutes(), checkGeocoding(),
      checkSupabase(), checkSptrans(), checkGps(), checkAndroidPerms(),
    ]);
  },
};
