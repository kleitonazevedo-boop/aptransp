import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Crosshair, MapPin, Route as RouteIcon, ArrowLeftRight,
  Bus, Car, Bike, Footprints, Star, Loader2, Home, Briefcase,
  Train, X, RotateCcw, Clock,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  autocompletePlaces, placeDetails, type AutocompleteSuggestion,
  searchNearbyTransit, type NearbyPlace,
} from "@/services/placesService";
import { reverseGeocode } from "@/services/geocodingService";
import { getCurrentLocation } from "@/services/locationService";
import {
  computeRoutes, formatDistance, formatDuration,
  type RouteResult, type TravelMode,
} from "@/services/routeService";
import { loadGoogleMaps, hasGoogleKey } from "@/services/googleMapsService";
import { useAuth } from "@/hooks/useAuth";
import { historyService, type RouteHistoryItem } from "@/services/historyService";
import { favoritesService, type FavoriteRoute } from "@/services/favoritesService";
import { profileService } from "@/services/profileService";
import { sptransService } from "@/services/sptransService";
import { placesFavoritesService } from "@/services/placesFavoritesService";

interface Props { onBack?: () => void; initialMode?: ContentMode; embedded?: boolean }

type ContentMode = "default" | "route" | "favorites" | "nearby-lines" | "nearby-stations";

interface SelectedPoint { label: string; latitude: number; longitude: number }

const STATION_TYPES = ["subway_station", "train_station", "light_rail_station"] as const;

const RouteScreen = ({ onBack, initialMode = "default", embedded = false }: Props) => {
  const { user } = useAuth();

  // Form state
  const [originText, setOriginText] = useState("");
  const [destinationText, setDestinationText] = useState("");
  const [origin, setOrigin] = useState<SelectedPoint | null>(null);
  const [destination, setDestination] = useState<SelectedPoint | null>(null);
  const [originSuggestions, setOriginSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [focused, setFocused] = useState<"origin" | "destination" | null>(null);
  const [mode, setMode] = useState<TravelMode>("TRANSIT");

  // Content state
  const [contentMode, setContentMode] = useState<ContentMode>(initialMode);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [recent, setRecent] = useState<RouteHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteRoute[]>([]);
  const [nearbyBuses, setNearbyBuses] = useState<NearbyPlace[]>([]);
  const [nearbyStations, setNearbyStations] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Map
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  // ---------- Load profile / recent / favorites
  useEffect(() => { void loadRecent(); }, [user]);
  const loadRecent = async () => { setRecent(await historyService.listRecent(5)); };
  const loadFavorites = async () => { setFavorites(await favoritesService.list(10)); };

  // ---------- Init map (always, used by route + nearby modes)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasGoogleKey()) return;
      try {
        const maps = await loadGoogleMaps();
        if (cancelled || !mapRef.current || mapInstance.current) return;
        mapInstance.current = new maps.Map(mapRef.current, {
          center: { lat: -23.5505, lng: -46.6333 },
          zoom: 12, disableDefaultUI: true, zoomControl: true, clickableIcons: false,
        });
      } catch (e) { console.error("[RouteScreen] map:", e); }
    })();
    return () => { cancelled = true; };
  }, [contentMode]);

  // ---------- Autocomplete
  useEffect(() => {
    if (focused !== "origin") return;
    const t = setTimeout(async () => {
      try { setOriginSuggestions(await autocompletePlaces(originText)); } catch (e) { console.error(e); }
    }, 250);
    return () => clearTimeout(t);
  }, [originText, focused]);

  useEffect(() => {
    if (focused !== "destination") return;
    const t = setTimeout(async () => {
      try { setDestinationSuggestions(await autocompletePlaces(destinationText)); } catch (e) { console.error(e); }
    }, 250);
    return () => clearTimeout(t);
  }, [destinationText, focused]);

  const pickSuggestion = async (which: "origin" | "destination", s: AutocompleteSuggestion) => {
    try {
      const d = await placeDetails(s.placeId);
      const point: SelectedPoint = { label: d.displayName || s.primary, latitude: d.latitude, longitude: d.longitude };
      if (which === "origin") {
        setOrigin(point); setOriginText(d.formattedAddress || s.primary); setOriginSuggestions([]);
      } else {
        setDestination(point); setDestinationText(d.formattedAddress || s.primary); setDestinationSuggestions([]);
      }
      setFocused(null);
    } catch (e) { console.error(e); setError("Não foi possível obter detalhes do local."); }
  };

  const useMyLocation = async (): Promise<SelectedPoint | null> => {
    try {
      const loc = await getCurrentLocation();
      const geo = await reverseGeocode(loc.latitude, loc.longitude);
      const point: SelectedPoint = { label: "Minha localização", latitude: loc.latitude, longitude: loc.longitude };
      setOrigin(point);
      setOriginText(geo.formattedAddress ?? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`);
      setOriginSuggestions([]);
      return point;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao obter localização.");
      return null;
    }
  };

  const swap = () => {
    setOrigin(destination); setDestination(origin);
    setOriginText(destinationText); setDestinationText(originText);
  };

  // ---------- Route compute
  const computeAndShow = useCallback(async (forceMode: TravelMode = mode) => {
    setError(null); setInfo(null);
    if (!origin && !originText) { setError("Informe a origem."); return; }
    if (!destination && !destinationText) { setError("Informe o destino."); return; }
    setLoading(true); setRoutes([]); setContentMode("route");
    try {
      const o = origin ? { lat: origin.latitude, lng: origin.longitude } : originText;
      const d = destination ? { lat: destination.latitude, lng: destination.longitude } : destinationText;
      const res = await computeRoutes(o, d, forceMode);
      if (!res.routes.length) { setError("Nenhuma rota encontrada."); return; }
      setRoutes(res.routes);
      setSelectedRouteIdx(0);
      await drawRoute(res.routes[0]);

      const first = res.routes[0];
      if (user) {
        await historyService.push({
          origem: originText, destino: destinationText, modo_transporte: forceMode,
          distancia: first.totalDistanceMeters, tempo_estimado: first.totalDurationSeconds,
        });
        void loadRecent();
      }
    } catch (e) {
      console.error(e); setError("Não foi possível calcular a rota.");
    } finally {
      setLoading(false);
    }
  }, [origin, destination, originText, destinationText, mode, user]);

  const drawRoute = async (r: RouteResult) => {
    const map = mapInstance.current; if (!map) return;
    const maps = await loadGoogleMaps();
    polylineRef.current?.setMap(null);
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    const path = maps.geometry?.encoding ? maps.geometry.encoding.decodePath(r.overviewPolyline) : null;
    if (path) {
      polylineRef.current = new maps.Polyline({
        path, strokeColor: "#7c3aed", strokeOpacity: 0.95, strokeWeight: 5, map,
      });
    }
    const start = r.raw.legs[0].start_location;
    const end = r.raw.legs[0].end_location;
    markersRef.current.push(new maps.Marker({ position: start, map, label: "A" }));
    markersRef.current.push(new maps.Marker({ position: end, map, label: "B" }));
    map.fitBounds(r.raw.bounds);
  };

  // ---------- Shortcuts: Casa / Trabalho / Favoritos
  const runShortcut = async (kind: "casa" | "trabalho") => {
    setError(null); setInfo(null);
    if (!user) { setError("Faça login para usar atalhos."); return; }
    setLoading(true);
    try {
      const profile = await profileService.getMyProfile();
      const addr = kind === "casa" ? profile?.endereco_residencial : profile?.endereco_trabalho;
      if (!addr) { setError(`Cadastre seu endereço ${kind === "casa" ? "residencial" : "de trabalho"} no perfil.`); return; }
      const here = await useMyLocation();
      if (!here) return;
      setDestination(null); setDestinationText(addr);
      // micro-delay para state propagar antes de computar
      setTimeout(() => { void computeAndShow(mode); }, 50);
    } finally { setLoading(false); }
  };

  const openFavorites = async () => {
    if (!user) { setError("Faça login para ver favoritos."); return; }
    setContentMode("favorites");
    await loadFavorites();
  };

  const removeFavorite = async (id?: string) => {
    if (!id) return;
    await favoritesService.remove(id);
    await loadFavorites();
  };

  const runFavorite = (f: FavoriteRoute) => {
    setOriginText(f.origem); setDestinationText(f.destino);
    setOrigin(null); setDestination(null);
    setMode((f.modo_transporte as TravelMode) ?? "TRANSIT");
    setTimeout(() => { void computeAndShow((f.modo_transporte as TravelMode) ?? "TRANSIT"); }, 50);
  };

  const saveCurrentRoute = async () => {
    if (!user) { setError("Faça login para favoritar."); return; }
    const r = routes[selectedRouteIdx]; if (!r) return;
    const saved = await favoritesService.add({
      origem: originText, destino: destinationText, modo_transporte: mode,
      distancia: r.totalDistanceMeters, tempo_estimado: r.totalDurationSeconds,
    });
    setInfo(saved ? "Adicionada aos favoritos." : "Não foi possível salvar.");
  };

  // ---------- Nearby
  const loadNearbyBuses = async () => {
    setError(null); setLoading(true); setContentMode("nearby-lines");
    try {
      const loc = await getCurrentLocation();
      const places = await searchNearbyTransit({ lat: loc.latitude, lng: loc.longitude }, 800, ["bus_station"]);
      setNearbyBuses(places);
      drawNearbyMarkers(places, loc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao buscar linhas próximas.");
    } finally { setLoading(false); }
  };

  const loadNearbyStations = async () => {
    setError(null); setLoading(true); setContentMode("nearby-stations");
    try {
      const loc = await getCurrentLocation();
      // searchNearbyTransit aceita lista de includedPrimaryTypes
      const places = await searchNearbyTransit(
        { lat: loc.latitude, lng: loc.longitude }, 1500,
        [...STATION_TYPES] as unknown as ("subway_station" | "train_station")[],
      );
      // garante exclusão de qualquer bus_station residual
      const filtered = places.filter((p) => !p.type?.includes("bus"));
      setNearbyStations(filtered);
      drawNearbyMarkers(filtered, loc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao buscar estações próximas.");
    } finally { setLoading(false); }
  };

  const drawNearbyMarkers = async (places: NearbyPlace[], center: { latitude: number; longitude: number }) => {
    const map = mapInstance.current; if (!map) return;
    const maps = await loadGoogleMaps();
    polylineRef.current?.setMap(null);
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    markersRef.current.push(new maps.Marker({
      position: { lat: center.latitude, lng: center.longitude }, map,
      label: { text: "•", color: "white" },
      icon: { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#7c3aed", fillOpacity: 1, strokeColor: "white", strokeWeight: 2 },
    }));
    const bounds = new maps.LatLngBounds({ lat: center.latitude, lng: center.longitude });
    places.forEach((p) => {
      const pos = { lat: p.latitude, lng: p.longitude };
      markersRef.current.push(new maps.Marker({ position: pos, map }));
      bounds.extend(pos);
    });
    if (places.length) map.fitBounds(bounds);
    else map.setCenter({ lat: center.latitude, lng: center.longitude });
  };

  // ---------- Render helpers
  const selected = useMemo(() => routes[selectedRouteIdx], [routes, selectedRouteIdx]);

  const handleRecentClick = (r: RouteHistoryItem) => {
    setOriginText(r.origem); setDestinationText(r.destino);
    setOrigin(null); setDestination(null);
    setMode((r.modo_transporte as TravelMode) ?? "TRANSIT");
    setTimeout(() => { void computeAndShow((r.modo_transporte as TravelMode) ?? "TRANSIT"); }, 50);
  };

  // ---------- UI
  return (
    <div className={`flex-1 flex flex-col ${embedded ? "bg-transparent" : "bg-white"}`}>
      {!embedded && (
        <>
          <header className="bg-brand-purple text-white px-4 pt-4 pb-3 flex items-center justify-between">
            <button onClick={onBack} aria-label="Voltar" className="p-1"><ArrowLeft className="w-6 h-6" /></button>
            <Logo className="w-8 h-8" />
            <RouteIcon className="w-5 h-5 text-brand-yellow" />
          </header>
          <div className="bg-brand-yellow text-blue-900 text-center text-sm font-bold py-2 flex items-center justify-center gap-2">
            <RouteIcon className="w-4 h-4" /> Traçado de Rota
          </div>
        </>
      )}

      <div className={`flex flex-col overflow-y-auto flex-1 ${embedded ? "" : "bg-amber-50"}`}>
        {/* Inputs */}
        <div className="p-3 space-y-3">
          <div className="bg-white rounded-2xl p-3 space-y-2 shadow-sm relative">
            <div className="flex items-center gap-2 border-b border-amber-200 pb-2 relative">
              <MapPin className="w-4 h-4 text-amber-700" />
              <input value={originText}
                     onChange={(e) => { setOriginText(e.target.value); setOrigin(null); }}
                     onFocus={() => setFocused("origin")}
                     placeholder="De onde você está?"
                     className="flex-1 bg-transparent outline-none text-sm text-blue-900 placeholder:text-blue-900/50" />
              <button onClick={useMyLocation} aria-label="Usar GPS" className="text-amber-700">
                <Crosshair className="w-4 h-4" />
              </button>
            </div>
            {focused === "origin" && originSuggestions.length > 0 && (
              <ul className="absolute z-30 left-0 right-0 top-14 bg-white shadow-lg rounded-xl mt-1 max-h-60 overflow-auto border border-amber-100">
                {originSuggestions.map((s) => (
                  <li key={s.placeId}>
                    <button onMouseDown={(e) => { e.preventDefault(); pickSuggestion("origin", s); }}
                            className="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm text-blue-900">
                      <span className="font-semibold">{s.primary}</span>
                      {s.secondary && <span className="block text-xs text-blue-900/60">{s.secondary}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2 relative">
              <MapPin className="w-4 h-4 text-amber-700" />
              <input value={destinationText}
                     onChange={(e) => { setDestinationText(e.target.value); setDestination(null); }}
                     onFocus={() => setFocused("destination")}
                     placeholder="Para onde você vai?"
                     className="flex-1 bg-transparent outline-none text-sm text-blue-900 placeholder:text-blue-900/50" />
              <button onClick={swap} aria-label="Inverter" className="text-amber-700">
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </div>
            {focused === "destination" && destinationSuggestions.length > 0 && (
              <ul className="absolute z-30 left-0 right-0 top-full bg-white shadow-lg rounded-xl mt-1 max-h-60 overflow-auto border border-amber-100">
                {destinationSuggestions.map((s) => (
                  <li key={s.placeId}>
                    <button onMouseDown={(e) => { e.preventDefault(); pickSuggestion("destination", s); }}
                            className="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm text-blue-900">
                      <span className="font-semibold">{s.primary}</span>
                      {s.secondary && <span className="block text-xs text-blue-900/60">{s.secondary}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Atalhos: 4 colunas */}
          <div className="grid grid-cols-4 gap-2">
            <Shortcut icon={<RouteIcon className="w-5 h-5" />} label="Traçar rota" onClick={() => computeAndShow(mode)} />
            <Shortcut icon={<Home className="w-5 h-5" />} label="Casa" onClick={() => runShortcut("casa")} />
            <Shortcut icon={<Briefcase className="w-5 h-5" />} label="Trabalho" onClick={() => runShortcut("trabalho")} />
            <Shortcut icon={<Star className="w-5 h-5" />} label="Favoritos" onClick={openFavorites} />
          </div>

          {/* Modos */}
          <div className="grid grid-cols-4 gap-2">
            <ModeBtn active={mode === "WALKING"} onClick={() => setMode("WALKING")} icon={<Footprints className="w-4 h-4" />} label="A pé" />
            <ModeBtn active={mode === "TRANSIT"} onClick={() => setMode("TRANSIT")} icon={<Bus className="w-4 h-4" />} label="Público" />
            <ModeBtn active={mode === "DRIVING"} onClick={() => setMode("DRIVING")} icon={<Car className="w-4 h-4" />} label="Carro" />
            <ModeBtn active={mode === "BICYCLING"} onClick={() => setMode("BICYCLING")} icon={<Bike className="w-4 h-4" />} label="Bike" />
          </div>

          <button onClick={() => computeAndShow(mode)} disabled={loading}
                  className="w-full bg-brand-purple text-white rounded-full py-3 text-sm font-semibold shadow-md disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Calculando…</> : "Traçar rota"}
          </button>

          {error && <div className="bg-red-100 text-red-800 text-xs rounded-xl px-3 py-2">{error}</div>}
          {info && <div className="bg-emerald-100 text-emerald-800 text-xs rounded-xl px-3 py-2">{info}</div>}
        </div>

        {/* Card principal — muda conforme contentMode */}
        <div className="px-3 pb-6 space-y-3">
          {/* Mapa (sempre montado, fica oculto no default/favorites) */}
          <div ref={mapRef}
               className={`w-full h-56 rounded-2xl bg-slate-100 shadow-sm ${
                 contentMode === "default" || contentMode === "favorites" ? "hidden" : ""
               }`} />

          {/* Modo: default → rotas recentes */}
          {contentMode === "default" && (
            <div className="bg-white rounded-2xl p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-blue-900">Rotas recentes</p>
                <Clock className="w-4 h-4 text-blue-900/50" />
              </div>
              {recent.length === 0 ? (
                <p className="text-xs text-blue-900/60 py-3 text-center">
                  {user ? "Nenhuma rota ainda. Trace sua primeira rota acima." : "Faça login para guardar suas rotas."}
                </p>
              ) : (
                <ul className="divide-y divide-amber-100">
                  {recent.map((r) => (
                    <li key={r.id}>
                      <button onClick={() => handleRecentClick(r)}
                              className="w-full flex items-center justify-between py-2 text-left">
                        <span className="text-xs font-medium text-blue-900">{r.origem} → {r.destino}</span>
                        <span className="text-xs text-blue-900/60">
                          {r.tempo_estimado ? formatDuration(r.tempo_estimado) : "—"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Modo: route → resumo + passos */}
          {contentMode === "route" && selected && (
            <>
              {routes.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {routes.map((r, i) => (
                    <button key={i}
                            onClick={() => { setSelectedRouteIdx(i); void drawRoute(r); }}
                            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border ${
                              i === selectedRouteIdx ? "bg-brand-purple text-white border-brand-purple" : "bg-white text-blue-900 border-amber-200"
                            }`}>
                      Opção {i + 1} · {formatDuration(r.totalDurationSeconds)} · {r.transfers} integ.
                    </button>
                  ))}
                </div>
              )}

              <div className="bg-amber-100 rounded-2xl p-3 grid grid-cols-3 text-center text-blue-900">
                <div><p className="text-[10px] uppercase opacity-70">Tempo</p>
                     <p className="text-base font-bold">{formatDuration(selected.totalDurationSeconds)}</p></div>
                <div><p className="text-[10px] uppercase opacity-70">Distância</p>
                     <p className="text-base font-bold">{formatDistance(selected.totalDistanceMeters)}</p></div>
                <div><p className="text-[10px] uppercase opacity-70">Integrações</p>
                     <p className="text-base font-bold">{selected.transfers}</p></div>
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

              <button onClick={saveCurrentRoute}
                      className="w-full flex items-center justify-center gap-2 bg-amber-200 text-amber-900 rounded-full py-3 text-sm font-semibold">
                <Star className="w-4 h-4" /> Salvar nos favoritos
              </button>
            </>
          )}

          {/* Modo: favorites */}
          {contentMode === "favorites" && (
            <div className="bg-white rounded-2xl p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-blue-900">Suas rotas favoritas</p>
                <button onClick={() => setContentMode("default")} className="text-blue-900/60">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {favorites.length === 0 ? (
                <p className="text-xs text-blue-900/60 py-3 text-center">Sem favoritos ainda.</p>
              ) : (
                <ul className="divide-y divide-amber-100">
                  {favorites.map((f) => (
                    <li key={f.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-blue-900 truncate">{f.origem} → {f.destino}</p>
                        <p className="text-[11px] text-blue-900/60">
                          {f.modo_transporte} · {f.tempo_estimado ? formatDuration(f.tempo_estimado) : "—"}
                        </p>
                      </div>
                      <button onClick={() => runFavorite(f)} aria-label="Executar"
                              className="p-1 text-brand-purple"><RotateCcw className="w-4 h-4" /></button>
                      <button onClick={() => removeFavorite(f.id)} aria-label="Remover"
                              className="p-1 text-red-500"><X className="w-4 h-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Modo: nearby-lines (ônibus) */}
          {contentMode === "nearby-lines" && (
            <div className="bg-white rounded-2xl p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-blue-900 flex items-center gap-2">
                  <Bus className="w-4 h-4" /> Linhas próximas
                </p>
                <button onClick={() => setContentMode("default")} className="text-blue-900/60"><X className="w-4 h-4" /></button>
              </div>
              {nearbyBuses.length === 0 ? (
                <p className="text-xs text-blue-900/60 py-3 text-center">Nenhum ponto de ônibus próximo.</p>
              ) : (
                <ul className="divide-y divide-amber-100">
                  {nearbyBuses.map((p) => (
                    <li key={p.id} className="py-2">
                      <p className="text-sm font-medium text-blue-900">{p.name}</p>
                      <p className="text-[11px] text-blue-900/60">{p.address}</p>
                      <p className="text-[11px] text-blue-900/60">
                        {p.distanceMeters ? `${Math.round(p.distanceMeters)} m` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[10px] text-blue-900/50 mt-2 text-center">
                Previsão de chegada disponível após deploy da função sptrans-proxy.
              </p>
            </div>
          )}

          {/* Modo: nearby-stations (sem ônibus) */}
          {contentMode === "nearby-stations" && (
            <div className="bg-white rounded-2xl p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-blue-900 flex items-center gap-2">
                  <Train className="w-4 h-4" /> Estações próximas
                </p>
                <button onClick={() => setContentMode("default")} className="text-blue-900/60"><X className="w-4 h-4" /></button>
              </div>
              {nearbyStations.length === 0 ? (
                <p className="text-xs text-blue-900/60 py-3 text-center">Nenhuma estação no raio de 1.5 km.</p>
              ) : (
                <ul className="divide-y divide-amber-100">
                  {nearbyStations.map((p) => (
                    <li key={p.id} className="py-2">
                      <p className="text-sm font-medium text-blue-900">{p.name}</p>
                      <p className="text-[11px] text-blue-900/60">{p.address}</p>
                      <p className="text-[11px] text-blue-900/60">
                        {p.type.replace("_", " ")} · {p.distanceMeters ? `${Math.round(p.distanceMeters)} m` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Atalhos rápidos para os modos extras (Linhas/Estações próximas) */}
        <div className="px-3 pb-6 grid grid-cols-2 gap-2">
          <button onClick={loadNearbyBuses}
                  className="bg-white border border-amber-200 rounded-2xl py-3 flex items-center justify-center gap-2 text-xs font-semibold text-blue-900">
            <Bus className="w-4 h-4" /> Linhas próximas
          </button>
          <button onClick={loadNearbyStations}
                  className="bg-white border border-amber-200 rounded-2xl py-3 flex items-center justify-center gap-2 text-xs font-semibold text-blue-900">
            <Train className="w-4 h-4" /> Estações próximas
          </button>
        </div>

        {!hasGoogleKey() && (
          <div className="m-3 p-3 bg-yellow-100 text-yellow-900 text-xs rounded-xl">
            Conecte o Google Maps Platform para habilitar busca, rotas e mapa.
          </div>
        )}
      </div>
    </div>
  );
};

const Shortcut = ({ icon, label, onClick }: { icon: JSX.Element; label: string; onClick: () => void }) => (
  <button onClick={onClick}
          className="bg-amber-200 text-amber-900 rounded-2xl py-3 flex flex-col items-center justify-center gap-1 shadow-sm">
    {icon}<span className="text-[10px] font-semibold">{label}</span>
  </button>
);

const ModeBtn = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: JSX.Element; label: string }) => (
  <button onClick={onClick}
          className={`rounded-xl py-2 flex flex-col items-center gap-1 text-xs font-semibold ${
            active ? "bg-brand-purple text-white" : "bg-white text-blue-900 border border-amber-200"
          }`}>
    {icon}{label}
  </button>
);

export default RouteScreen;
// referência mantida para evitar tree-shake do service usado por implementações futuras
void sptransService;
