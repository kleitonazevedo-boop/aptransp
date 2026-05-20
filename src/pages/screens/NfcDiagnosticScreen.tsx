import { useEffect, useState } from "react";
import { ArrowLeft, Smartphone, Wifi, AlertTriangle, Loader2, CheckCircle2, XCircle, Radio } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { onNfcResult, type NfcData, type NfcStatus } from "@/services/nfcService";

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

const detectDevice = (): DeviceStatus => {
  const ua = navigator.userAgent;
  const w = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    NDEFReader?: unknown;
  };
  const isNative = !!w.Capacitor?.isNativePlatform?.();
  const platform = w.Capacitor?.getPlatform?.() ?? (isNative ? "native" : "web");
  const webNfc = typeof w.NDEFReader !== "undefined";
  const looksAndroid = /Android/i.test(ua);
  const model = (ua.match(/\(([^)]+)\)/)?.[1] ?? "Desconhecido").slice(0, 60);

  return {
    hasNfc: isNative ? null : webNfc || looksAndroid ? true : false,
    nfcEnabled: null,
    model,
    platform,
    isNative,
  };
};

const NfcDiagnosticScreen = ({ onBack }: Props) => {
  const [device, setDevice] = useState<DeviceStatus | null>(null);
  const [status, setStatus] = useState<NfcStatus>("idle");
  const [result, setResult] = useState<NfcData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDevice(detectDevice());
  }, []);

  // Listener global de eventos NFC vindos do bridge nativo (Capacitor)
  useEffect(() => {
    const unsubscribe = onNfcResult((data) => {
      console.log("NFC DATA:", data);
      setResult(data);
      setStatus("success");
      setError(null);
    });
    return unsubscribe;
  }, []);

  const handleStartScan = () => {
    setError(null);
    setResult(null);
    setStatus("scanning");
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
        <div className="flex items-start gap-2 bg-brand-yellow/15 border border-brand-yellow/40 rounded-xl p-3">
          <AlertTriangle className="w-5 h-5 text-brand-yellow shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/80 leading-snug">
            <strong className="font-semibold">Modo técnico.</strong> Leitura realizada pelo módulo
            nativo Android via Capacitor. O frontend apenas exibe os dados recebidos.
          </p>
        </div>

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

        <Card className="p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Radio className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">2. Leitura NFC técnica</h2>
            <StatusBadge status={status} />
          </div>

          <Button
            onClick={handleStartScan}
            disabled={status === "scanning"}
            className="w-full"
            size="lg"
          >
            {status === "scanning" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Aguardando cartão…
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" /> Iniciar leitura NFC
              </>
            )}
          </Button>

          {status === "scanning" && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Aproxime o cartão NFC da parte traseira do aparelho.
            </p>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2 bg-destructive/10 text-destructive rounded-lg p-2 text-xs">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {status === "success" && result && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-success text-xs font-medium">
                <CheckCircle2 className="w-4 h-4" /> Cartão detectado com sucesso
              </div>
              <dl className="text-xs space-y-2 bg-slate-100 rounded-lg p-3">
                <Row label="UID" value={result.uid} mono />
                <Row label="Tecnologias" value={result.tech.join(", ") || "—"} />
                {result.timestamp && (
                  <Row
                    label="Timestamp"
                    value={new Date(result.timestamp).toLocaleString("pt-BR")}
                  />
                )}
              </dl>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Saldo: <strong>indisponível</strong> nesta versão (mock). A leitura de saldo
                será adicionada em etapa futura.
              </p>
            </div>
          )}
        </Card>

        <Card className="p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Integração nativa</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Esta tela escuta o evento <code className="font-mono text-[11px]">nfcResult</code>{" "}
            emitido pelo módulo nativo Android via Capacitor. O frontend não acessa o NFC
            diretamente — apenas recebe <code className="font-mono text-[11px]">uid</code> e{" "}
            <code className="font-mono text-[11px]">tech</code> do bridge.
          </p>
        </Card>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: NfcStatus }) => {
  const map: Record<NfcStatus, { label: string; cls: string }> = {
    idle: { label: "idle", cls: "bg-slate-200 text-slate-700" },
    scanning: { label: "scanning", cls: "bg-brand-yellow/30 text-yellow-800" },
    success: { label: "success", cls: "bg-success/20 text-success" },
    error: { label: "error", cls: "bg-destructive/15 text-destructive" },
  };
  const s = map[status];
  return (
    <span className={`ml-auto text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.label}
    </span>
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
