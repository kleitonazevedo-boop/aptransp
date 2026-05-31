import { loadGoogleMaps } from "./googleMapsService";

export interface AutocompleteSuggestion {
  placeId: string;
  primary: string;
  secondary: string;
}

let sessionToken: google.maps.places.AutocompleteSessionToken | null = null;

async function ensureToken() {
  const maps = await loadGoogleMaps();
  if (!sessionToken) sessionToken = new maps.places.AutocompleteSessionToken();
  return sessionToken;
}

/** Autocomplete (Places API New). Retorna sugestões para o texto digitado. */
export async function autocompletePlaces(
  input: string,
  bias?: { lat: number; lng: number },
): Promise<AutocompleteSuggestion[]> {
  if (input.trim().length < 2) return [];
  const maps = await loadGoogleMaps();
  const token = await ensureToken();
  const { AutocompleteSuggestion } = (await google.maps.importLibrary(
    "places",
  )) as google.maps.PlacesLibrary;

  const request: google.maps.places.AutocompleteRequest = {
    input,
    sessionToken: token,
    region: "br",
    language: "pt-BR",
    ...(bias
      ? {
          locationBias: new maps.Circle({
            center: { lat: bias.lat, lng: bias.lng },
            radius: 30_000,
          }),
        }
      : {}),
  };
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
  return suggestions
    .filter((s) => s.placePrediction)
    .map((s) => {
      const p = s.placePrediction!;
      return {
        placeId: p.placeId,
        primary: p.mainText?.toString() ?? p.text.toString(),
        secondary: p.secondaryText?.toString() ?? "",
      };
    });
}

/** Resolve placeId em coordenadas + endereço. */
export async function placeDetails(placeId: string): Promise<{
  latitude: number;
  longitude: number;
  formattedAddress: string;
  displayName: string;
}> {
  await loadGoogleMaps();
  const { Place } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
  const place = new Place({ id: placeId });
  await place.fetchFields({
    fields: ["location", "formattedAddress", "displayName"],
  });
  sessionToken = null; // encerra sessão após detalhes
  if (!place.location) throw new Error("Local sem coordenadas.");
  return {
    latitude: place.location.lat(),
    longitude: place.location.lng(),
    formattedAddress: place.formattedAddress ?? "",
    displayName: place.displayName ?? "",
  };
}

export type TransitPlaceType = "bus_station" | "subway_station" | "train_station" | "transit_station";

export interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  type: TransitPlaceType | string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
}

/** Busca estações/terminais próximos via Places API (New) searchNearby. */
export async function searchNearbyTransit(
  center: { lat: number; lng: number },
  radius = 1000,
  types: TransitPlaceType[] = ["bus_station", "subway_station", "train_station", "transit_station"],
): Promise<NearbyPlace[]> {
  await loadGoogleMaps();
  const { Place, SearchNearbyRankPreference } = (await google.maps.importLibrary(
    "places",
  )) as google.maps.PlacesLibrary;

  const request: google.maps.places.SearchNearbyRequest = {
    fields: ["id", "displayName", "location", "formattedAddress", "types"],
    locationRestriction: { center, radius },
    includedPrimaryTypes: types,
    maxResultCount: 20,
    rankPreference: SearchNearbyRankPreference.DISTANCE,
    language: "pt-BR",
    region: "br",
  };

  const { places } = await Place.searchNearby(request);
  return places.map((p) => {
    const lat = p.location?.lat() ?? 0;
    const lng = p.location?.lng() ?? 0;
    return {
      id: p.id ?? "",
      name: p.displayName ?? "Sem nome",
      address: p.formattedAddress ?? "",
      type: (p.types?.[0] as TransitPlaceType) ?? "transit_station",
      latitude: lat,
      longitude: lng,
      distanceMeters: distance(center.lat, center.lng, lat, lng),
    };
  });
}

function distance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
