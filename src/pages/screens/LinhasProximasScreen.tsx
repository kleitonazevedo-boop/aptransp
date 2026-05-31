import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bus, Train, MapPin, Search, RefreshCw, Star, Loader2, Crosshair, Building2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { getCurrentLocation, watchLocation, type DeviceLocation } from "@/services/locationService";
import { reverseGeocode } from "@/services/geocodingService";
import { findNearby, type NearbyLine } from "@/services/nearbyService";
import type { NearbyPlace } from "@/services/placesService";
import { databaseService } from "@/services/databaseService";
import { loadGoogleMaps, hasGoogleKey } from "@/services/googleMapsService";

interface Props { onBack: () => void }

type FilterType = "all" | "bus" | "subway" | "train" | "terminal";

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "all",      label: "Todos" },
  { id: "bus",      label: "Ônibus" },
  { id: "subway",   label: "Metrô" },
  { id: "train",    label: "Trem" },
  { id: "terminal", label: "Terminal" },
];

const transportTypeMap: Record<string, FilterType> = {
  bus_station: "bus",
  subway_station: "subway",
  train_station: "train",
  transit_station: "terminal",
  bus: "bus",
  subway: "subway",
  train: "train",
  terminal: "terminal",
};

const LinhasProximasScreen = ({ onBack }: Props) => {
  const [loc, setLoc] = useState<DeviceLocation | null>(null);
  const [address, setAddress] = useState<string>("");
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [lines, setLines] = useState<NearbyLine[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [query, setQuery] = useState("");

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  // Inicializa
  useEffect(() => {
    let stop: () => void = () => {};
    (async () => {
      try {
        const initial = await getCurrentLocation();
        setLoc(initial);
        const favs = await databaseService.listFavoriteLines();
        setFavorites(favs);
        await loadNearby(initial);
        stop = watchLocation(async (next) => {
          setLoc(next);
          await loadNearby(next);
        }, (e) => console.warn(e.message));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível obter sua localização.");
        setLoading(false);
      }
    })();
    return () => stop();
  }, []);

  // Mapa
  useEffect(() => {
    if (!hasGoogleKey() || !loc) return;
    (async () => {
      const maps = await loadGoogleMaps();
      if (!mapRef.current) return;
      if (!mapInstance.current) {
        mapInstance.current = new maps.Map(mapRef.current, {
          center: { lat: loc.latitude, lng: loc.longitude },
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });
      } else {
        mapInstance.current.setCenter({ lat: loc.latitude, lng: loc.longitude });
      }
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      markersRef.current.push(
        new maps.Marker({
          position: { lat: loc.latitude, lng: loc.longitude },
          map: mapInstance.current,
          title: "Você",
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#7c3aed",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        }),
      );
      for (const p of places) {
        markersRef.current.push(
          new maps.Marker({
            position: { lat: p.latitude, lng: p.longitude },
            map: mapInstance.current,
            title: p.name,
          }),
        );
      }
    })();
  }, [loc, places]);

  const loadNearby = async (l: DeviceLocation) => {
    setLoading(true);
    setError(null);
    try {
      const geo = await reverseGeocode(l.latitude, l.longitude);
      setAddress(geo.formattedAddress ?? "");
      const { places: p, lines: ls } = await findNearby(l.latitude, l.longitude);
      setPlaces(p);
      setLines(ls);
    } catch (e) {
      console.error(e);
      setError("Não foi possível consultar os serviços de localização.");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    try {
      const fresh = await getCurrentLocation();
      setLoc(fresh);
      await loadNearby(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar localização.");
    }
  };

  const filteredLines = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lines.filter((l) => {
      if (filter !== "all" && l.transportType !== filter) return false;
      if (!q) return true;
      return (
        l.lineCode.toLowerCase().includes(q) ||
        l.lineName.toLowerCase().includes(q) ||
        l.origin.toLowerCase().includes(q) ||
        l.destination.toLowerCase().includes(q)
      );
    });
  }, [lines, filter, query]);

  const filteredPlaces = useMemo(() => {
    return places.filter((p) => {
      const norm = transportTypeMap[p.type] ?? "terminal";
      return filter === "all" || norm === filter;
    });
  }, [places, filter]);

  const toggleFav = async (lineId: string) => {
    const isFav = favorites.includes(lineId);
    const next = await databaseService.toggleFavoriteLine(lineId, isFav);
    setFavorites((prev) => (next ? [...prev, lineId] : prev.filter((id) => id !== lineId)));
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="bg-brand-purple text-white px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={onBack} aria-label="Voltar" className="p-1"><ArrowLeft className="w-6 h-6" /></button>
        <Logo className="w-8 h-8" />
        <Bus className="w-5 h-5 text-brand-yellow" />
      </header>
      <div className="bg-brand-purple text-white text-center text-sm font-bold py-2">
        LINHAS PRÓXIMAS
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Endereço */}
        <div className="px-3 pt-3 flex items-start gap-2 text-xs text-blue-900">
          <MapPin className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
          <p className="flex-1 leading-snug">{address || (loc ? "Localizando endereço…" : "Aguardando localização…")}</p>
          <button onClick={refresh} aria-label="Atualizar" className="text-amber-700"><Crosshair className="w-4 h-4" /></button>
        </div>

        {/* Mapa */}
        <div className="px-3 pt-3">
          <div ref={mapRef} className="w-full h-44 rounded-2xl bg-slate-100 shadow-sm" />
        </div>

        {/* Busca + filtros */}
        <div className="px-3 pt-3 space-y-2">
          <div className="flex items-center gap-2 bg-amber-50 rounded-full px-3 py-2 border border-amber-200">
            <Search className="w-4 h-4 text-amber-700" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Linha, terminal, estação…"
              className="flex-1 bg-transparent outline-none text-sm text-blue-900 placeholder:text-blue-900/50"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {FILTERS.map((f) => {
              const count = f.id === "all" ? lines.length : lines.filter((l) => l.transportType === f.id).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    filter === f.id ? "bg-brand-purple text-white border-brand-purple" : "bg-white text-blue-900 border-amber-200"
                  }`}
                >
                  {f.label} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Estados */}
        {loading && (
          <div className="p-6 flex flex-col items-center gap-2 text-blue-900">
            <Loader2 className="w-6 h-6 animate-spin text-brand-purple" />
            <p className="text-sm">Buscando linhas próximas…</p>
          </div>
        )}
        {!loading && error && (
          <div className="m-3 bg-red-100 text-red-800 rounded-xl p-3 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={refresh} className="ml-2 underline flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Tentar novamente</button>
          </div>
        )}

        {/* Lista de linhas */}
        {!loading && !error && filteredLines.length === 0 && filteredPlaces.length > 0 && (
          <div className="p-3 text-xs text-blue-900/70">
            Nenhuma linha cadastrada para estes pontos. Estações encontradas próximas:
          </div>
        )}

        <ul className="px-3 pb-3 space-y-2">
          {filteredLines.map((l) => {
            const isFav = favorites.includes(l.id);
            const Icon = l.transportType === "subway" ? Train : l.transportType === "train" ? Train : Bus;
            return (
              <li key={l.id} className="bg-white rounded-2xl border border-amber-100 p-3 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center"><Icon className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-blue-900">{l.lineCode}</p>
                  <p className="text-xs text-blue-900/70 truncate">{l.origin} → {l.destination}</p>
                  <p className="text-[11px] text-blue-900/60">{Math.round(l.distanceMeters)} m · {labelType(l.transportType)}</p>
                </div>
                <button onClick={() => toggleFav(l.id)} aria-label="Favoritar">
                  <Star className={`w-5 h-5 ${isFav ? "fill-amber-500 text-amber-500" : "text-amber-500"}`} />
                </button>
              </li>
            );
          })}

          {filteredLines.length === 0 && filteredPlaces.map((p) => (
            <li key={p.id} className="bg-amber-50/70 rounded-2xl border border-amber-100 p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-blue-900 truncate">{p.name}</p>
                <p className="text-xs text-blue-900/60 truncate">{p.address}</p>
                <p className="text-[11px] text-blue-900/60">{Math.round(p.distanceMeters ?? 0)} m · {labelPlaceType(p.type)}</p>
              </div>
            </li>
          ))}

          {!loading && !error && filteredLines.length === 0 && filteredPlaces.length === 0 && (
            <li className="p-4 text-center text-sm text-blue-900/70">
              Nenhuma linha encontrada próxima da sua localização.
              <button onClick={refresh} className="block mt-2 mx-auto underline">Atualizar busca</button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

function labelType(t: string): string {
  if (t === "bus") return "Ônibus";
  if (t === "subway") return "Metrô";
  if (t === "train") return "Trem";
  return "Terminal";
}
function labelPlaceType(t: string): string {
  if (t === "bus_station") return "Ponto de ônibus";
  if (t === "subway_station") return "Estação de metrô";
  if (t === "train_station") return "Estação de trem";
  return "Terminal";
}

export default LinhasProximasScreen;
