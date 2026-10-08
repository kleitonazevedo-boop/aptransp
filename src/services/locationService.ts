import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export type LocationErrorCode =
  | "PERMISSION_DENIED"
  | "PERMISSION_BLOCKED"
  | "GPS_DISABLED"
  | "POSITION_UNAVAILABLE"
  | "TIMEOUT"
  | "UNSUPPORTED";

export class LocationServiceError extends Error {
  constructor(public readonly code: LocationErrorCode, message: string) {
    super(message);
    this.name = "LocationServiceError";
  }
}

export interface LocationPermission {
  state: string;
  granted: boolean;
  blocked: boolean;
}

const SETTINGS_MESSAGE =
  "A localização está bloqueada. Ative-a nas configurações do aplicativo para usar este recurso.";

function permissionState(status: { location?: string; coarseLocation?: string }): string {
  return status.location ?? status.coarseLocation ?? "unknown";
}

/** Consulta o estado sem abrir o diálogo de permissão. Útil para diagnósticos. */
export async function checkLocationPermission(): Promise<LocationPermission> {
  if (Capacitor.isNativePlatform()) {
    const state = permissionState(await Geolocation.checkPermissions());
    return { state, granted: state === "granted", blocked: state === "denied" || state === "prompt-with-rationale" };
  }

  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return { state: "unknown", granted: false, blocked: false };
  }
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return { state: status.state, granted: status.state === "granted", blocked: status.state === "denied" };
  } catch {
    return { state: "unknown", granted: false, blocked: false };
  }
}

async function ensureNativePermission(): Promise<void> {
  let state: string;
  try {
    state = permissionState(await Geolocation.checkPermissions());
  } catch (error) {
    throw normalizeLocationError(error, "check");
  }

  if (state === "granted") return;
  // prompt-with-rationale means Android has already shown and the user declined;
  // honor that choice and direct them to Settings instead of showing repeated dialogs.
  if (state === "denied" || state === "prompt-with-rationale") {
    throw new LocationServiceError("PERMISSION_BLOCKED", SETTINGS_MESSAGE);
  }
  if (state !== "prompt") {
    throw new LocationServiceError("PERMISSION_BLOCKED", SETTINGS_MESSAGE);
  }

  try {
    const requested = await Geolocation.requestPermissions({ permissions: ["location"] });
    if (permissionState(requested) === "granted") return;
    throw new LocationServiceError(
      "PERMISSION_DENIED",
      "Permissão de localização negada. Autorize o acesso durante o uso para encontrar linhas, paradas e definir a origem da rota.",
    );
  } catch (error) {
    if (error instanceof LocationServiceError) throw error;
    throw normalizeLocationError(error, "request");
  }
}

function normalizeLocationError(error: unknown, stage: "position" | "check" | "request"): LocationServiceError {
  const candidate = error as { code?: number | string; message?: string } | null;
  const code = candidate?.code;
  const message = (candidate?.message ?? "").toLowerCase();

  if (
    message.includes("location services are disabled") ||
    message.includes("location services are not enabled") ||
    message.includes("location service is disabled") ||
    message.includes("location permission not granted") && stage === "check"
  ) {
    return new LocationServiceError("GPS_DISABLED", "Ative os serviços de localização do aparelho e tente novamente.");
  }
  if (code === 1 || code === "1" || message.includes("permission") || message.includes("denied")) {
    return new LocationServiceError(
      stage === "check" ? "PERMISSION_BLOCKED" : "PERMISSION_DENIED",
      stage === "check" ? SETTINGS_MESSAGE : "Permissão de localização negada. Autorize o acesso durante o uso.",
    );
  }
  if (code === 3 || code === "3" || message.includes("timeout") || message.includes("timed out")) {
    return new LocationServiceError("TIMEOUT", "Não foi possível obter sua localização a tempo. Verifique o sinal de GPS e tente novamente.");
  }
  if (code === 2 || code === "2" || message.includes("unavailable")) {
    return new LocationServiceError("POSITION_UNAVAILABLE", "Sua localização está indisponível. Verifique o GPS e tente novamente.");
  }
  if (stage === "check" && (message.includes("service") || message.includes("gps"))) {
    return new LocationServiceError("GPS_DISABLED", "Ative os serviços de localização do aparelho e tente novamente.");
  }
  return new LocationServiceError("POSITION_UNAVAILABLE", "Não foi possível obter sua localização. Verifique o GPS e tente novamente.");
}

function validLocation(position: Pick<GeolocationPosition, "coords">): DeviceLocation {
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new LocationServiceError("POSITION_UNAVAILABLE", "O aparelho não retornou coordenadas válidas.");
  }
  return { latitude, longitude, ...(Number.isFinite(accuracy) ? { accuracy } : {}) };
}

export async function getCurrentLocation(timeoutMs = 8000): Promise<DeviceLocation> {
  if (Capacitor.isNativePlatform()) {
    await ensureNativePermission();
    try {
      return validLocation(await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 30_000,
      }));
    } catch (error) {
      throw normalizeLocationError(error, "position");
    }
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new LocationServiceError("UNSUPPORTED", "Este dispositivo não oferece suporte à localização.");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        try { resolve(validLocation(position)); }
        catch (error) { reject(error); }
      },
      (error) => reject(normalizeLocationError(error, "position")),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

/** Observa mudanças >= minDistanceMeters. Retorna função de cancelamento. */
export function watchLocation(
  onUpdate: (loc: DeviceLocation) => void,
  onError?: (err: Error) => void,
  minDistanceMeters = 50,
): () => void {
  if (Capacitor.isNativePlatform()) {
    let cancelled = false;
    let watchId: string | null = null;
    let last: DeviceLocation | null = null;
    void ensureNativePermission()
      .then(async () => {
        if (cancelled) return;
        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 },
          (position, error) => {
            if (error) { onError?.(normalizeLocationError(error, "position")); return; }
            if (!position) return;
            try {
              const next = validLocation(position);
              if (!last || haversine(last, next) >= minDistanceMeters) {
                last = next;
                onUpdate(next);
              }
            } catch (error) { onError?.(error instanceof Error ? error : new Error("Localização indisponível.")); }
          },
        );
        if (cancelled && watchId) await Geolocation.clearWatch({ id: watchId });
      })
      .catch((error: unknown) => onError?.(error instanceof Error ? error : new Error("Localização indisponível.")));
    return () => {
      cancelled = true;
      if (watchId) void Geolocation.clearWatch({ id: watchId });
    };
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError?.(new LocationServiceError("UNSUPPORTED", "Este dispositivo não oferece suporte à localização."));
    return () => {};
  }
  let last: DeviceLocation | null = null;
  const id = navigator.geolocation.watchPosition(
    (position) => {
      try {
        const next = validLocation(position);
        if (!last || haversine(last, next) >= minDistanceMeters) {
          last = next;
          onUpdate(next);
        }
      } catch (error) { onError?.(error instanceof Error ? error : new Error("Localização indisponível.")); }
    },
    (error) => onError?.(normalizeLocationError(error, "position")),
    { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

export function haversine(a: DeviceLocation, b: DeviceLocation): number {
  const R = 6371e3;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
