import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Crosshair, MapPin, Route as RouteIcon, ArrowLeftRight, Bus, Car, Bike, Footprints, Star, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  autocompletePlaces,
  placeDetails,
  type AutocompleteSuggestion,
} from "@/services/placesService";
import { reverseGeocode } from "@/services/geocodingService";
import { getCurrentLocation } from "@/services/locationService";
import {
  computeRoutes,
  formatDistance,
  formatDuration,
  type RouteResult,
  type TravelMode,
} from "@/services/routeService";
import { loadGoogleMaps, hasGoogleKey } from "@/services/googleMapsService";
import { databaseService } from "@/services/databaseService";

interface Props { onBack: () => void }

interface SelectedPoint {
  label: string;
  latitude: number;
  longitude: number;
}

const CACHE_LAST = "aptransp_last_route_v1";

const RouteScreen = ({ onBack }: Props) => {
  const [originText, setOriginText] = useState("");
  const [destinationText, setDestinationText] = useState("");
  const [origin, setOrigin] = useState<SelectedPoint | null>(null);
  const [destination, setDestination] = useState<SelectedPoint | null>(null);
  const [originSuggestions, setOriginSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [focused, setFocused] = useState<"origin" | "destination" | null>(null);
  const [mode, setMode] = useState<TravelMode>("TRANSIT");
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  // hidrata última rota
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_LAST);
      if (raw) {
        const parsed = JSON.parse(raw);
        setOriginText(parsed.originText ?? "");
        setDestinationText(parsed.destinationText ?? "");
      }
    } catch { /* ignore */ }
  }, []);

  // Inicializa mapa
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasGoogleKey()) return;
      try {
        const maps = await loadGoogleMaps();
        if (cancelled || !mapRef.current) return;
        mapInstance.current = new maps.Map(mapRef.current, {
          center: { lat: -23.5505, lng: -46.6333 },
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });
      } catch (e) {
        console.error("[RouteScreen] mapa:", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Autocomplete debounce
  useEffect(() => {
    if (focused !== "origin") return;
    const t = setTimeout(async () => {
      try {
        const s = await autocompletePlaces(originText);
        setOriginSuggestions(s);
      } catch (e) { console.error(e); }
    }, 250);
    return () => clearTimeout(t);
  }, [originText, focused]);

  useEffect(() => {
    if (focused !== "destination") return;
    const t = setTimeout(async () => {
      try {
        const s = await autocompletePlaces(destinationText);
        setDestinationSuggestions(s);
      } catch (e) { console.error(e); }
    }, 250);
    return () => clearTimeout(t);
  }, [destinationText, focused]);

  const pickSuggestion = async (which: "origin" | "destination", s: AutocompleteSuggestion) => {
    try {
      const d = await placeDetails(s.placeId);
      const point: SelectedPoint = {
        label: d.displayName || s.primary,
        latitude: d.latitude,
        longitude: d.longitude,
      };
      if (which === "origin") {
        setOrigin(point);
        setOriginText(d.formattedAddress || s.primary);
        setOriginSuggestions([]);
      } else {
        setDestination(point);
        setDestinationText(d.formattedAddress || s.primary);
        setDestinationSuggestions([]);
      }
      setFocused(null);
    } catch (e) {
      console.error(e);
      setError("Não foi possível obter detalhes do local.");
    }
  };

  const useMyLocation = async () => {
    try {
      const loc = await getCurrentLocation();
      const geo = await reverseGeocode(loc.latitude, loc.longitude);
      setOrigin({ label: "Minha localização", latitude: loc.latitude, longitude: loc.longitude });
      setOriginText(geo.formattedAddress ?? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`);
      setOriginSuggestions([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao obter localização.");
    }
  };

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
    setOriginText(destinationText);
    setDestinationText(originText);
  };

  const traceRoute = async () => {
    setError(null);
    if (!origin && !originText) { setError("Informe a origem."); return; }
    if (!destination && !destinationText) { setError("Informe o destino."); return; }
    setLoading(true);
    setRoutes([]);
    try {
      const o = origin
        ? { lat: origin.latitude, lng: origin.longitude }
        : originText;
      const d = destination
        ? { lat: destination.latitude, lng: destination.longitude }
        : destinationText;
      const res = await computeRoutes(o, d, mode);
      if (!res.routes.length) { setError("Nenhuma rota encontrada."); return; }
      setRoutes(res.routes);
      setSelectedRouteIdx(0);
      drawRoute(res.routes[0]);

      const first = res.routes[0];
      localStorage.setItem(CACHE_LAST, JSON.stringify({ originText, destinationText, savedAt: Date.now() }));
      databaseService.pushHistory({
        origin: originText,
        destination: destinationText,
        distance: first.totalDistanceMeters,
        duration: first.totalDurationSeconds,
      });
    } catch (e) {
      console.error(e);
      setError("Não foi possível calcular a rota.");
    } finally {
      setLoading(false);
    }
  };

  const drawRoute = async (r: RouteResult) => {
    const map = mapInstance.current;
    if (!map) return;
    const maps = await loadGoogleMaps();
    polylineRef.current?.setMap(null);
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const path = maps.geometry?.encoding
      ? maps.geometry.encoding.decodePath(r.overviewPolyline)
      : null;
    if (path) {
      polylineRef.current = new maps.Polyline({
        path,
        strokeColor: "#7c3aed",
        strokeOpacity: 0.95,
        strokeWeight: 5,
        map,
      });
    }

    const start = r.raw.legs[0].start_location;
    const end = r.raw.legs[0].end_location;
    markersRef.current.push(new maps.Marker({ position: start, map, label: "A" }));
    markersRef.current.push(new maps.Marker({ position: end, map, label: "B" }));

    map.fitBounds(r.raw.bounds);
  };

  const saveRoute = async () => {
    if (!routes.length) return;
    const saved = await databaseService.saveRoute({
      name: `${originText} → ${destinationText}`,
      origin: originText,
      destination: destinationText,
    });
    if (saved) setError("Rota salva nos favoritos.");
    else setError("Não foi possível salvar (verifique o schema do Supabase).");
  };

  const selected = useMemo(() => routes[selectedRouteIdx], [routes, selectedRouteIdx]);

  // Carrega geometry library on demand
  useEffect(() => {
    (async () => {
      try { await google.maps.importLibrary("geometry"); } catch { /* ignore */ }
    })();
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="bg-brand-purple text-white px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={onBack} aria-label="Voltar" className="p-1">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <Logo className="w-8 h-8" />
        <RouteIcon className="w-5 h-5 text-brand-yellow" />
      </header>
      <div className="bg-brand-purple text-white text-center text-sm font-bold py-2">
        TRAÇADO DE ROTA
      </div>

      <div className="flex flex-col overflow-y-auto flex-1">
        {/* Inputs */}
        <div className="p-3 space-y-2 bg-amber-50">
          <div className="bg-white rounded-2xl p-3 space-y-2 shadow-sm relative">
            <div className="flex items-center gap-2 border-b border-amber-200 pb-2 relative">
              <MapPin className="w-4 h-4 text-amber-700" />
              <input
                value={originText}
                onChange={(e) => { setOriginText(e.target.value); setOrigin(null); }}
                onFocus={() => setFocused("origin")}
                placeholder="De onde você está?"
                className="flex-1 bg-transparent outline-none text-sm text-blue-900 placeholder:text-blue-900/50"
              />
              <button onClick={useMyLocation} aria-label="Usar GPS" className="text-amber-700">
                <Crosshair className="w-4 h-4" />
              </button>
            </div>
            {focused === "origin" && originSuggestions.length > 0 && (
              <ul className="absolute z-30 left-0 right-0 top-full bg-white shadow-lg rounded-xl mt-1 max-h-60 overflow-auto border border-amber-100">
                {originSuggestions.map((s) => (
                  <li key={s.placeId}>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); pickSuggestion("origin", s); }}
                      className="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm text-blue-900"
                    >
                      <span className="font-semibold">{s.primary}</span>
                      {s.secondary && <span className="block text-xs text-blue-900/60">{s.secondary}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2 relative">
              <MapPin className="w-4 h-4 text-amber-700" />
              <input
                value={destinationText}
                onChange={(e) => { setDestinationText(e.target.value); setDestination(null); }}
                onFocus={() => setFocused("destination")}
                placeholder="Para onde você vai?"
                className="flex-1 bg-transparent outline-none text-sm text-blue-900 placeholder:text-blue-900/50"
              />
              <button onClick={swap} aria-label="Inverter" className="text-amber-700">
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </div>
            {focused === "destination" && destinationSuggestions.length > 0 && (
              <ul className="absolute z-30 left-0 right-0 top-full bg-white shadow-lg rounded-xl mt-1 max-h-60 overflow-auto border border-amber-100">
                {destinationSuggestions.map((s) => (
                  <li key={s.placeId}>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); pickSuggestion("destination", s); }}
                      className="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm text-blue-900"
                    >
                      <span className="font-semibold">{s.primary}</span>
                      {s.secondary && <span className="block text-xs text-blue-900/60">{s.secondary}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Modos */}
          <div className="grid grid-cols-4 gap-2">
            <ModeBtn active={mode === "WALKING"} onClick={() => setMode("WALKING")} icon={<Footprints className="w-4 h-4" />} label="A pé" />
            <ModeBtn active={mode === "TRANSIT"} onClick={() => setMode("TRANSIT")} icon={<Bus className="w-4 h-4" />} label="Público" />
            <ModeBtn active={mode === "DRIVING"} onClick={() => setMode("DRIVING")} icon={<Car className="w-4 h-4" />} label="Carro" />
            <ModeBtn active={mode === "BICYCLING"} onClick={() => setMode("BICYCLING")} icon={<Bike className="w-4 h-4" />} label="Bike" />
          </div>

          <button
            onClick={traceRoute}
            disabled={loading}
            className="w-full bg-brand-purple text-white rounded-full py-3 text-sm font-semibold shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Calculando rota…</> : "Traçar rota"}
          </button>
          {error && (
            <div className="bg-red-100 text-red-800 text-xs rounded-xl px-3 py-2 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={traceRoute} className="underline">Tentar novamente</button>
            </div>
          )}
        </div>

        {/* Mapa */}
        <div className="px-3">
          <div ref={mapRef} className="w-full h-56 rounded-2xl bg-slate-100 shadow-sm" />
        </div>

        {/* Alternativas */}
        {routes.length > 1 && (
          <div className="px-3 pt-3 flex gap-2 overflow-x-auto">
            {routes.map((r, i) => (
              <button
                key={i}
                onClick={() => { setSelectedRouteIdx(i); drawRoute(r); }}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border ${
                  i === selectedRouteIdx ? "bg-brand-purple text-white border-brand-purple" : "bg-white text-blue-900 border-amber-200"
                }`}
              >
                Opção {i + 1} · {formatDuration(r.totalDurationSeconds)} · {r.transfers} integ.
              </button>
            ))}
          </div>
        )}

        {/* Resumo + passos */}
        {selected && (
          <div className="p-3 space-y-3">
            <div className="bg-amber-100 rounded-2xl p-3 grid grid-cols-3 text-center text-blue-900">
              <div>
                <p className="text-[10px] uppercase opacity-70">Tempo</p>
                <p className="text-base font-bold">{formatDuration(selected.totalDurationSeconds)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase opacity-70">Distância</p>
                <p className="text-base font-bold">{formatDistance(selected.totalDistanceMeters)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase opacity-70">Integrações</p>
                <p className="text-base font-bold">{selected.transfers}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-amber-100 divide-y divide-amber-50">
              {selected.steps.map((s, i) => (
                <div key={i} className="p-3 flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-blue-900">{s.instruction}</p>
                    <p className="text-[11px] text-blue-900/60">
                      {formatDistance(s.distanceMeters)} · {formatDuration(s.durationSeconds)}
                      {s.transitLine && <> · <span className="font-semibold">{s.transitVehicle ?? "Transporte"} {s.transitLine}</span></>}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={saveRoute} className="w-full flex items-center justify-center gap-2 bg-amber-200 text-amber-900 rounded-full py-3 text-sm font-semibold">
              <Star className="w-4 h-4" /> Salvar rota
            </button>
          </div>
        )}

        {!hasGoogleKey() && (
          <div className="m-3 p-3 bg-yellow-100 text-yellow-900 text-xs rounded-xl">
            Conecte o Google Maps Platform para habilitar busca de endereços e rotas.
          </div>
        )}
      </div>
    </div>
  );
};

const ModeBtn = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: JSX.Element; label: string }) => (
  <button
    onClick={onClick}
    className={`rounded-xl py-2 flex flex-col items-center gap-1 text-xs font-semibold ${
      active ? "bg-brand-purple text-white" : "bg-white text-blue-900 border border-amber-200"
    }`}
  >
    {icon}{label}
  </button>
);

export default RouteScreen;
