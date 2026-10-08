import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Crosshair, MapPin, Route as RouteIcon, ArrowLeftRight,
  Bus, Car, Bike, Footprints, Star, Loader2, Home, Briefcase,
  Train, X, RotateCcw, Clock,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  autocompletePlaces, placeDetails, type AutocompleteSuggestion,
} from "@/services/placesService";
import { reverseGeocode } from "@/services/geocodingService";
import { getCurrentLocation } from "@/services/locationService";
import { queryNearbyTransit, NearbyDataError } from "@/services/nearbyTransitService";
import {
  computeRoutes, formatDistance, formatDuration,
  type RouteResult, type TravelMode,
} from "@/services/routeService";
import { loadGoogleMaps, hasGoogleKey } from "@/services/googleMapsService";
import { useAuth } from "@/hooks/useAuth";
import { historyService, type RouteHistoryItem } from "@/services/historyService";
import { favoritesService, type FavoriteRoute } from "@/services/favoritesService";
import { profileService } from "@/services/profileService";
import { placesFavoritesService } from "@/services/placesFavoritesService";
import { connectivityService } from "@/services/connectivityService";
import {
  gtfsRepository, type NearbyStop, type NearbyGtfsLine,
} from "@/repositories/gtfsRepository";
import { gtfsService } from "@/services/gtfsService";

interface Props { onBack?: () => void; initialMode?: ContentMode; embedded?: boolean }

type ContentMode = "default" | "route" | "favorites" | "nearby-lines" | "nearby-stations";

interface SelectedPoint { label: string; latitude: number; longitude: number }

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
  const [nearbyLines, setNearbyLines] = useState<NearbyGtfsLine[]>([]);
  const [nearbyStops, setNearbyStops] = useState<NearbyStop[]>([]);
  const [nearbyState, setNearbyState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [gtfsMissing, setGtfsMissing] = useState(false);
  const [isOnline, setIsOnline] = useState(connectivityService.isOnline());
  const [gtfsSyncRunning, setGtfsSyncRunning] = useState(false);
  const [gtfsSyncMessage, setGtfsSyncMessage] = useState("");
  const [gtfsSyncError, setGtfsSyncError] = useState<string | null>(null);
  const [gtfsUpdateAvailable, setGtfsUpdateAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Map
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => connectivityService.subscribe(setIsOnline), []);

  // ---------- Load profile / recent / favorites
  useEffect(() => { void loadRecent(); }, [user]);
  const loadRecent = async () => { setRecent(await historyService.listRecent(5)); };
  const loadFavorites = async () => { setFavorites(await favoritesService.list(10)); };

  // ---------- Google Maps is an online-only layer; GTFS lookups stay local.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isOnline || !hasGoogleKey() || mapInstance.current) return;
      try {
        const maps = await loadGoogleMaps();
        if (cancelled || !mapRef.current || mapInstance.current) return;
        mapInstance.current = new maps.Map(mapRef.current, {
          center: { lat: -23.5505, lng: -46.6333 },
          zoom: 12, disableDefaultUI: true, zoomControl: true, clickableIcons: false,
          gestureHandling: "cooperative",
        });
      } catch (e) { console.warn("[RouteScreen] Google Maps indisponível."); }
    })();
    return () => { cancelled = true; };
  }, [contentMode, isOnline]);

  // Drop stale suggestions on disconnect so a selection cannot trigger online place details.
  useEffect(() => {
    if (!isOnline) {
      setOriginSuggestions([]);
      setDestinationSuggestions([]);
    }
  }, [isOnline]);

  // ---------- Autocomplete
  useEffect(() => {
    if (focused !== "origin" || !isOnline) return;
    const t = setTimeout(async () => {
      try { setOriginSuggestions(await autocompletePlaces(originText)); } catch (e) { console.error(e); }
    }, 250);
    return () => clearTimeout(t);
  }, [originText, focused, isOnline]);

  useEffect(() => {
    if (focused !== "destination" || !isOnline) return;
    const t = setTimeout(async () => {
      try { setDestinationSuggestions(await autocompletePlaces(destinationText)); } catch (e) { console.error(e); }
    }, 250);
    return () => clearTimeout(t);
  }, [destinationText, focused, isOnline]);

  const pickSuggestion = async (which: "origin" | "destination", s: AutocompleteSuggestion) => {
    if (!connectivityService.isOnline()) {
      setError("A busca de endereços precisa de internet. As consultas de linhas e paradas continuam offline.");
      return;
    }
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
      const point: SelectedPoint = { label: "Minha localização", latitude: loc.latitude, longitude: loc.longitude };
      setOrigin(point);
      const geo = isOnline ? await reverseGeocode(loc.latitude, loc.longitude) : null;
      setOriginText(geo?.formattedAddress ?? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`);
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
    if (!connectivityService.isOnline()) {
      setError("Sem conexão. O traçado de rotas exige internet — paradas e linhas próximas funcionam offline.");
      return;
    }
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
    const map = mapInstance.current;
    if (!isOnline || !map) return;
    let maps: typeof google.maps;
    try { maps = await loadGoogleMaps(); }
    catch { console.warn("[RouteScreen] Mapa indisponível; mantendo consulta GTFS local."); return; }
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

  const favPlace = async (which: "origem" | "destino") => {
    if (!user) { setError("Faça login para favoritar."); return; }
    const point = which === "origem" ? origin : destination;
    const text = which === "origem" ? originText : destinationText;
    if (!text) { setError(`Informe ${which} primeiro.`); return; }
    const label = prompt(`Nome do favorito (Casa, Trabalho, ...):`, which === "origem" ? "Casa" : "Trabalho");
    if (!label) return;
    const kind = label.toLowerCase().includes("casa") ? "casa"
      : label.toLowerCase().includes("trabalho") ? "trabalho" : "custom";
    const saved = await placesFavoritesService.add({
      label, endereco: text,
      latitude: point?.latitude ?? null, longitude: point?.longitude ?? null,
      kind,
    });
    setInfo(saved ? `${label} salvo nos favoritos.` : "Falha ao salvar.");
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

  // ---------- Nearby (OFFLINE: GTFS local)
  const syncGtfsDatabase = async () => {
    if (gtfsSyncRunning) return;
    setGtfsSyncRunning(true);
    setGtfsSyncError(null);
    setGtfsSyncMessage("Consultando versão disponível…");
    try {
      const result = await gtfsService.syncPublishedPackage((stage, detail) => {
        const messages: Record<string, string> = {
          downloading: "Baixando dados de transporte…",
          validating: "Validando base SQLite…",
          installing: "Instalando dados offline…",
          ready: "Dados offline instalados",
        };
        setGtfsSyncMessage((messages[stage] ?? "Sincronizando dados de transporte…") + (stage === "downloading" && detail?.endsWith("%") ? " " + detail : ""));
      });
      setGtfsUpdateAvailable(false);
      setGtfsSyncMessage(result.status === "offline" ? "Sem conexão; usando a base local existente." : result.status === "current" ? "Dados offline já atualizados." : "Dados offline instalados");
      const dataset = await gtfsRepository.validateDataset();
      setGtfsMissing(!dataset.valid);
      if (dataset.valid && (contentMode === "nearby-lines" || contentMode === "nearby-stations")) {
        setNearbyState("idle");
        setNearbyError("Dados instalados. Toque novamente em Linhas próximas ou Estações próximas para consultar.");
      }
    } catch (error) {
      setGtfsSyncError(error instanceof Error ? error.message : "Não foi possível instalar os dados offline.");
      setGtfsSyncMessage("");
    } finally {
      setGtfsSyncRunning(false);
    }
  };

  useEffect(() => {
    if (!isOnline || (contentMode !== "nearby-lines" && contentMode !== "nearby-stations")) return;
    let active = true;
    void gtfsService.checkRemoteVersion()
      .then(({ updateAvailable }) => { if (active) setGtfsUpdateAvailable(updateAvailable); })
      .catch(() => { /* sem rede, a base local permanece disponível */ });
    return () => { active = false; };
  }, [contentMode, isOnline]);

  const loadNearbyBuses = async () => {
    setError(null);
    setNearbyError(null);
    setNearbyState("loading");
    setNearbyLines([]);
    setLoading(true);
    setContentMode("nearby-lines");
    try {
      const loc = await getCurrentLocation();
      console.info("[GTFS-NEARBY] latitude: " + loc.latitude);
      console.info("[GTFS-NEARBY] longitude: " + loc.longitude);
      console.info("[GTFS-NEARBY] radius: 1000 m");
      const result = await queryNearbyTransit(loc, "lines", 1000);
      setGtfsMissing(false);
      setNearbyLines(result.lines);
      setNearbyState("ready");
      void drawNearbyMarkers(result.stops, loc);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Não foi possível consultar os dados locais.";
      if (e instanceof NearbyDataError && e.code === "GTFS_NOT_INSTALLED") {
        setGtfsMissing(true);
      }
      console.error("[GTFS-NEARBY] Nearby query failed: " + message);
      setNearbyError(message);
      setNearbyState("error");
    } finally {
      setLoading(false);
    }
  };

  const loadNearbyStations = async () => {
    setError(null);
    setNearbyError(null);
    setNearbyState("loading");
    setNearbyStops([]);
    setLoading(true);
    setContentMode("nearby-stations");
    try {
      const loc = await getCurrentLocation();
      console.info("[GTFS-NEARBY] latitude: " + loc.latitude);
      console.info("[GTFS-NEARBY] longitude: " + loc.longitude);
      console.info("[GTFS-NEARBY] radius: 1500 m");
      const result = await queryNearbyTransit(loc, "stops", 1500);
      setGtfsMissing(false);
      setNearbyStops(result.stops);
      setNearbyState("ready");
      void drawNearbyMarkers(result.stops, loc);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Não foi possível consultar os dados locais.";
      if (e instanceof NearbyDataError && e.code === "GTFS_NOT_INSTALLED") {
        setGtfsMissing(true);
      }
      setNearbyError(message);
      setNearbyState("error");
    } finally {
      setLoading(false);
    }
  };

  const drawNearbyMarkers = async (
    stops: NearbyStop[],
    center: { latitude: number; longitude: number },
  ) => {
    const map = mapInstance.current;
    if (!isOnline || !map) return;
    let maps: typeof google.maps;
    try {
      maps = await loadGoogleMaps();
    } catch {
      console.warn("[RouteScreen] Mapa indisponível; mantendo a consulta GTFS local.");
      return;
    }
    polylineRef.current?.setMap(null);
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    markersRef.current.push(new maps.Marker({
      position: { lat: center.latitude, lng: center.longitude }, map,
      label: { text: "•", color: "white" },
      icon: { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#7c3aed", fillOpacity: 1, strokeColor: "white", strokeWeight: 2 },
    }));
    const bounds = new maps.LatLngBounds({ lat: center.latitude, lng: center.longitude });
    stops.forEach((s) => {
      const pos = { lat: Number(s.stop_lat), lng: Number(s.stop_lon) };
      markersRef.current.push(new maps.Marker({ position: pos, map, title: s.stop_name }));
      bounds.extend(pos);
    });
    if (stops.length) map.fitBounds(bounds);
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
    <div className={`flex-1 min-h-0 flex flex-col ${embedded ? "bg-transparent" : "bg-white"}`}>
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

      <div className={`flex min-h-0 flex-col overflow-y-auto overscroll-contain touch-pan-y flex-1 pb-[calc(1rem+env(safe-area-inset-bottom))] ${embedded ? "" : "bg-amber-50"}`}>
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
              <button onClick={() => favPlace("origem")} aria-label="Favoritar origem" className="text-amber-700">
                <Star className="w-4 h-4" />
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
              <button onClick={() => favPlace("destino")} aria-label="Favoritar destino" className="text-amber-700">
                <Star className="w-4 h-4" />
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
          <div className={`relative w-full h-[clamp(10rem,28vh,14rem)] rounded-2xl bg-slate-100 shadow-sm overflow-hidden touch-pan-y ${
                 contentMode === "default" || contentMode === "favorites" ? "hidden" : ""
               }`}>
            <div ref={mapRef} className={`absolute inset-0 ${isOnline ? "" : "invisible"}`} />
            {!isOnline && (
              <div className="absolute inset-0 flex items-center justify-center px-5 text-center text-xs text-slate-600">
                O mapa precisa de internet. Linhas e paradas próximas continuam disponíveis offline.
              </div>
            )}
          </div>

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
              {nearbyLines.length === 0 ? (
                <div className="py-3 text-center">
                  <p className="text-xs text-blue-900/60">
                    {nearbyError
                      ? (gtfsMissing ? "Base de transporte não instalada ou sem dados." : nearbyError)
                      : nearbyState === "loading"
                        ? "Obtendo localização e consultando a base local…"
                        : nearbyState === "ready"
                          ? "Nenhuma linha próxima na base offline."
                          : "Toque em Linhas próximas para consultar os dados locais."}
                  </p>
                  {gtfsMissing && (
                    <button onClick={() => void syncGtfsDatabase()} disabled={gtfsSyncRunning}
                      className="mt-3 rounded-xl bg-brand-purple px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
                      {gtfsSyncRunning ? <><Loader2 className="mr-2 inline h-3 w-3 animate-spin" />{gtfsSyncMessage || "Baixando dados de transporte…"}</> : "Baixar dados offline"}
                    </button>
                  )}
                  {gtfsSyncRunning && <progress className="mt-3 block h-1.5 w-full" />}
                  {gtfsSyncError && <p role="alert" className="mt-2 text-xs text-red-600">{gtfsSyncError}</p>}
                  {!gtfsMissing && gtfsUpdateAvailable && (
                    <button onClick={() => void syncGtfsDatabase()} disabled={gtfsSyncRunning}
                      className="mt-3 rounded-xl border border-brand-purple px-4 py-2 text-xs font-semibold text-brand-purple disabled:opacity-60">
                      Atualizar dados offline
                    </button>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-amber-100">
                  {nearbyLines.map((l) => (
                    <li key={l.route_id} className="py-2">
                      <p className="text-sm font-medium text-blue-900">
                        {l.route_short_name} · {l.route_long_name}
                      </p>
                      <p className="text-[11px] text-blue-900/60">
                        Parada: {l.stop_name} · {Math.round(l.distanceMeters)} m
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {gtfsUpdateAvailable && (
                <button onClick={() => void syncGtfsDatabase()} disabled={gtfsSyncRunning}
                  className="mt-2 w-full rounded-xl border border-brand-purple px-3 py-2 text-xs font-semibold text-brand-purple disabled:opacity-60">
                  {gtfsSyncRunning ? <><Loader2 className="mr-2 inline h-3 w-3 animate-spin" />{gtfsSyncMessage || "Baixando dados de transporte…"}</> : "Atualização de dados disponível"}
                </button>
              )}
              {gtfsSyncRunning && <progress className="mt-2 block h-1.5 w-full" />}
              {gtfsSyncError && <p role="alert" className="mt-2 text-xs text-red-600">{gtfsSyncError}</p>}
              <p className="text-[10px] text-blue-900/50 mt-2 text-center">
                Dados GTFS offline no SQLite local.
              </p>
            </div>
          )}

          {/* Modo: nearby-stations (paradas GTFS) */}
          {contentMode === "nearby-stations" && (
            <div className="bg-white rounded-2xl p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-blue-900 flex items-center gap-2">
                  <Train className="w-4 h-4" /> Paradas e estações próximas
                </p>
                <button onClick={() => setContentMode("default")} className="text-blue-900/60"><X className="w-4 h-4" /></button>
              </div>
              {nearbyStops.length === 0 ? (
                <div className="py-3 text-center">
                  <p className="text-xs text-blue-900/60">
                    {nearbyError
                      ? (gtfsMissing ? "Base de transporte não instalada ou sem dados." : nearbyError)
                      : nearbyState === "loading"
                        ? "Obtendo localização e consultando a base local…"
                        : nearbyState === "ready"
                          ? "Nenhuma parada no raio de 1,5 km."
                          : "Toque em Estações próximas para consultar os dados locais."}
                  </p>
                  {gtfsMissing && (
                    <button onClick={() => void syncGtfsDatabase()} disabled={gtfsSyncRunning}
                      className="mt-3 rounded-xl bg-brand-purple px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
                      {gtfsSyncRunning ? <><Loader2 className="mr-2 inline h-3 w-3 animate-spin" />{gtfsSyncMessage || "Baixando dados de transporte…"}</> : "Baixar dados offline"}
                    </button>
                  )}
                  {gtfsSyncRunning && <progress className="mt-3 block h-1.5 w-full" />}
                  {gtfsSyncError && <p role="alert" className="mt-2 text-xs text-red-600">{gtfsSyncError}</p>}
                </div>
              ) : (
                <ul className="divide-y divide-amber-100">
                  {nearbyStops.map((s) => (
                    <li key={s.stop_id} className="py-2">
                      <p className="text-sm font-medium text-blue-900">{s.stop_name}</p>
                      <p className="text-[11px] text-blue-900/60">
                        #{s.stop_id} · {Math.round(s.distanceMeters)} m
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
