export interface DeviceLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export function getCurrentLocation(timeoutMs = 8000): Promise<DeviceLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não suportada neste dispositivo."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(new Error(err.message || "Não foi possível obter localização.")),
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
  if (!navigator.geolocation) {
    onError?.(new Error("Geolocalização não suportada."));
    return () => {};
  }
  let last: DeviceLocation | null = null;
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const next: DeviceLocation = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
      if (!last || haversine(last, next) >= minDistanceMeters) {
        last = next;
        onUpdate(next);
      }
    },
    (err) => onError?.(new Error(err.message || "Erro de geolocalização.")),
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
