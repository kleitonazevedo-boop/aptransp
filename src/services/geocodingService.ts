import { loadGoogleMaps } from "./googleMapsService";

export interface GeoPoint {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

/** Converte endereço em coordenadas (Google Maps Geocoder, client-side). */
export async function geocode(address: string): Promise<GeoPoint> {
  const maps = await loadGoogleMaps();
  const geocoder = new maps.Geocoder();
  const result = await geocoder.geocode({ address, region: "br" });
  const first = result.results[0];
  if (!first) throw new Error("Endereço não encontrado.");
  return {
    latitude: first.geometry.location.lat(),
    longitude: first.geometry.location.lng(),
    formattedAddress: first.formatted_address,
  };
}

/** Coordenadas em endereço legível. */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoPoint> {
  const maps = await loadGoogleMaps();
  const geocoder = new maps.Geocoder();
  const result = await geocoder.geocode({ location: { lat, lng } });
  const first = result.results[0];
  return {
    latitude: lat,
    longitude: lng,
    formattedAddress: first?.formatted_address,
  };
}
