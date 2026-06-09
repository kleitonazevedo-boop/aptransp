import { useState } from "react";
import { ArrowLeft, Crosshair, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { logger } from "@/services/loggerService";

interface Props { onBack: () => void }

interface GpsReading {
  lat: number; lng: number; accuracy: number; timestamp: number;
}

const GpsDebugScreen = ({ onBack }: Props) => {
  const [permState, setPermState] = useState<string>("desconhecido");
  const [reading, setReading] = useState<GpsReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkPerm = async () => {
    try {
      const p = await (navigator as Navigator & { permissions?: { query: (q: { name: PermissionName }) => Promise<PermissionStatus> } })
        .permissions?.query({ name: "geolocation" as PermissionName });
      setPermState(p?.state ?? "indisponível");
    } catch (e) { setPermState(String(e)); }
  };

  const getLoc = async () => {
    setError(null); setLoading(true);
    if (!("geolocation" in navigator)) {
      setError("navigator.geolocation indisponível");
      void logger.error("gps", "navigator.geolocation indisponível");
      setLoading(false); return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const r = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: pos.timestamp };
        setReading(r);
        void logger.info("gps", "Localização obtida", r);
        setLoading(false);
      },
      (err) => {
        setError(`${err.code} · ${err.message}`);
        void logger.error("gps", "Erro getCurrentPosition", { code: err.code, message: err.message });
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="bg-brand-purple text-white px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={onBack} aria-label="Voltar" className="p-1"><ArrowLeft className="w-6 h-6" /></button>
        <Logo className="w-8 h-8" />
        <span />
      </header>
      <div className="bg-brand-yellow text-blue-900 text-center text-sm font-bold py-2">Teste de Geolocalização</div>

      <div className="flex-1 overflow-y-auto bg-amber-50 p-4 space-y-3">
        <div className="bg-white rounded-2xl p-3 space-y-2">
          <Row k="Permissão" v={permState} />
          <button onClick={checkPerm} className="text-xs text-brand-purple underline">Verificar permissão</button>
        </div>

        <div className="bg-white rounded-2xl p-3 space-y-1">
          <Row k="Latitude" v={reading?.lat.toFixed(6) ?? "—"} />
          <Row k="Longitude" v={reading?.lng.toFixed(6) ?? "—"} />
          <Row k="Precisão" v={reading ? `${Math.round(reading.accuracy)} m` : "—"} />
          <Row k="Timestamp" v={reading ? new Date(reading.timestamp).toLocaleString() : "—"} />
        </div>

        {error && <div className="bg-red-100 text-red-800 text-xs rounded-xl p-3">{error}</div>}

        <button onClick={getLoc} disabled={loading}
                className="w-full bg-brand-purple text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
          Obter localização atual
        </button>
      </div>
    </div>
  );
};

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between text-sm">
    <span className="text-blue-900/60">{k}</span>
    <span className="font-mono text-blue-900">{v}</span>
  </div>
);

export default GpsDebugScreen;
