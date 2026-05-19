import { useEffect, useState } from "react";
import { ArrowLeft, Smartphone, Wifi, WifiOff, AlertTriangle, Loader2, CheckCircle2, XCircle, Radio } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  onBack: () => void;
}

interface DeviceStatus {
  hasNfc: boolean | null;
  nfcEnabled: boolean | null;
  model: string;
  platform: string;
  isNative: boolean;
}

interface NfcDump {
  uid: string;
  technologies: string[];
  cardType: string;
  atqa?: string;
  sak?: string;
  historicalBytes?: string;
  maxTransceiveLength?: number;
  timestamp: number;
}

// Future native integration entrypoint. When Capacitor + a native NFC plugin
// is wired up (e.g. `capacitor-nfc` or a custom Android plugin), this function
// will delegate to it. Today it returns null so we can fall back to a simulated
// technical dump for UI development.
const tryNativeNfcRead = async (): Promise<NfcDump | null> => {
  try {
    // Lazy access to a future global plugin without importing it.
    // Expected shape: window.Capacitor.Plugins.NfcReader.read()
    const w = window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        Plugins?: { NfcReader?: { read: () => Promise<NfcDump> } };
      };
    };
    const plugin = w.Capacitor?.Plugins?.NfcReader;
    if (plugin && typeof plugin.read === "function") {
      return await plugin.read();
    }
    return null;
  } catch {
    return null;
  }
};

const detectDevice = (): DeviceStatus => {
  const ua = navigator.userAgent;
  const w = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    NDEFReader?: unknown;
  };
  const isNative = !!w.Capacitor?.isNativePlatform?.();
  const platform = w.Capacitor?.getPlatform?.() ?? (isNative ? "native" : "web");
  // Web NFC (NDEFReader) exists only on Chrome Android; treat as hint when not native.
  const webNfc = typeof w.NDEFReader !== "undefined";
  const looksAndroid = /Android/i.test(ua);
  const model = (ua.match(/\(([^)]+)\)/)?.[1] ?? "Desconhecido").slice(0, 60);

  return {
    hasNfc: isNative ? null : webNfc || looksAndroid ? true : false,
    nfcEnabled: null, // só pode ser detectado por plugin nativo
    model,
    platform,
    isNative,
  };
};

const randHex = (n: number) =>
  Array.from({ length: n }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase(),
  ).join(":");

const simulateDump = (): NfcDump => ({
  uid: randHex(7),
  technologies: ["NfcA", "MifareClassic", "IsoDep"],
  cardType: "MIFARE Classic 1K (simulado)",
  atqa: "00:04",
  sak: "08",
  historicalBytes: randHex(8),
  maxTransceiveLength: 253,
  timestamp: Date.now(),
});

const NfcDiagnosticScreen = ({ onBack }: Props) => {
  const [device, setDevice] = useState<DeviceStatus | null>(null);
  const [reading, setReading] = useState(false);
  const [dump, setDump] = useState<NfcDump | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDevice(detectDevice());
  }, []);

  const handleRead = async () => {
    setReading(true);
    setError(null);
    setDump(null);
    try {
      const nativeResult = await tryNativeNfcRead();
      if (nativeResult) {
        setDump(nativeResult);
      } else {
        // Fallback: simulação para desenvolvimento da UI antes da integração nativa
        await new Promise((r) => setTimeout(r, 1800));
        setDump(simulateDump());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na leitura NFC");
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <header className="bg-brand-purple text-white px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={onBack} aria-label="Voltar" className="p-1">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <Logo className="w-8 h-8" />
        <Radio className="w-5 h-5 text-brand-yellow" />
      </header>
      <div className="bg-brand-purple text-white text-center text-xs font-bold py-2 uppercase tracking-wider">
        NFC Diagnostic Mode
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Modo técnico warning */}
        <div className="flex items-start gap-2 bg-brand-yellow/15 border border-brand-yellow/40 rounded-xl p-3">
          <AlertTriangle className="w-5 h-5 text-brand-yellow shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/80 leading-snug">
            <strong className="font-semibold">Modo técnico.</strong> Esta tela é destinada
            ao diagnóstico de hardware NFC e não realiza consulta de saldo.
          </p>
        </div>

        {/* 1. Status do dispositivo */}
        <Card className="p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">1. Status do dispositivo</h2>
          </div>
          {device ? (
            <dl className="text-xs space-y-2">
              <Row label="Plataforma" value={device.platform} />
              <Row label="Ambiente nativo" value={device.isNative ? "Sim" : "Não (web)"} />
              <BoolRow label="Possui NFC" value={device.hasNfc} hint={!device.isNative ? "Detecção definitiva requer plugin nativo" : undefined} />
              <BoolRow label="NFC ativado" value={device.nfcEnabled} hint="Disponível apenas no app nativo" />
              <Row label="Modelo / UA" value={device.model} mono />
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">Detectando…</p>
          )}
        </Card>

        {/* 2. Leitura NFC técnica */}
        <Card className="p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Radio className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">2. Leitura NFC técnica</h2>
          </div>

          <Button onClick={handleRead} disabled={reading} className="w-full" size="lg">
            {reading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Aguardando cartão…
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" /> Iniciar leitura NFC
              </>
            )}
          </Button>

          {reading && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Aproxime o cartão da parte traseira do aparelho.
            </p>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2 bg-destructive/10 text-destructive rounded-lg p-2 text-xs">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {dump && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-success text-xs font-medium">
                <CheckCircle2 className="w-4 h-4" /> Cartão detectado
              </div>
              <dl className="text-xs space-y-2 bg-slate-100 rounded-lg p-3">
                <Row label="UID" value={dump.uid} mono />
                <Row label="Tipo de cartão" value={dump.cardType} />
                <Row label="Tecnologias" value={dump.technologies.join(", ")} />
                {dump.atqa && <Row label="ATQA" value={dump.atqa} mono />}
                {dump.sak && <Row label="SAK" value={dump.sak} mono />}
                {dump.historicalBytes && (
                  <Row label="Historical bytes" value={dump.historicalBytes} mono />
                )}
                {dump.maxTransceiveLength !== undefined && (
                  <Row label="Max transceive" value={`${dump.maxTransceiveLength} bytes`} />
                )}
                <Row label="Timestamp" value={new Date(dump.timestamp).toLocaleString("pt-BR")} />
              </dl>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Dump técnico — saldo não é exibido neste modo. Quando o módulo nativo Android
                estiver disponível, estes valores virão diretamente do chip via Capacitor.
              </p>
            </div>
          )}
        </Card>

        {/* 3. Integração nativa */}
        <Card className="p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <WifiOff className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Integração nativa</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Esta tela está preparada para delegar a leitura a um plugin Capacitor
            (<code className="font-mono text-[11px]">window.Capacitor.Plugins.NfcReader</code>).
            Enquanto o módulo não estiver instalado, os valores acima são simulados para
            permitir o desenvolvimento da interface.
          </p>
        </Card>
      </div>
    </div>
  );
};

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-muted-foreground shrink-0">{label}</dt>
    <dd className={`text-right text-foreground ${mono ? "font-mono" : ""} break-all`}>{value}</dd>
  </div>
);

const BoolRow = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: boolean | null;
  hint?: string;
}) => (
  <div className="flex justify-between gap-3 items-start">
    <dt className="text-muted-foreground shrink-0">{label}</dt>
    <dd className="text-right">
      {value === null ? (
        <span className="text-muted-foreground italic text-[11px]">{hint ?? "indisponível"}</span>
      ) : value ? (
        <span className="inline-flex items-center gap-1 text-success font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> Sim
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-destructive font-medium">
          <XCircle className="w-3.5 h-3.5" /> Não
        </span>
      )}
    </dd>
  </div>
);

export default NfcDiagnosticScreen;
