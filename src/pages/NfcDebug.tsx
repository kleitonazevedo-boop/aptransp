import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Radio,
  Zap,
} from "lucide-react";

type ConnStatus = "waiting" | "received" | "error";

interface ParsedNfc {
  uid?: string;
  tech?: string[];
  timestamp?: number;
  [k: string]: unknown;
}

const statusMeta: Record<
  ConnStatus,
  { label: string; dot: string; text: string }
> = {
  waiting: { label: "AGUARDANDO", dot: "bg-yellow-400", text: "text-yellow-300" },
  received: { label: "EVENTO RECEBIDO", dot: "bg-emerald-400", text: "text-emerald-300" },
  error: { label: "ERRO", dot: "bg-red-500", text: "text-red-400" },
};

const shortTech = (t: string) => t.replace(/^android\.nfc\.tech\./, "");

const NfcDebug = () => {
  const [raw, setRaw] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedNfc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<ConnStatus>("waiting");
  const [lastAt, setLastAt] = useState<string | null>(null);

  useEffect(() => {
    console.log("[NFC-DEBUG] mount - listener registrado em window 'nfcResult'");

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      console.log("[NFC-DEBUG] evento recebido:", detail);

      const rawString =
        typeof detail === "string"
          ? detail
          : JSON.stringify(detail, null, 2);
      setRaw(rawString);
      setCount((c) => c + 1);
      setLastAt(new Date().toLocaleTimeString("pt-BR"));

      try {
        const data: ParsedNfc =
          typeof detail === "string"
            ? JSON.parse(detail)
            : (detail as ParsedNfc);
        console.log("[NFC-DEBUG] parsed JSON:", data);
        setParsed(data);
        setError(null);
        setStatus("received");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[NFC-DEBUG] erro de parse:", msg);
        setParsed(null);
        setError(msg);
        setStatus("error");
      }
    };

    window.addEventListener("nfcResult", handler);
    return () => {
      console.log("[NFC-DEBUG] unmount - listener removido");
      window.removeEventListener("nfcResult", handler);
    };
  }, []);

  const simulate = () => {
    const payload = JSON.stringify({
      uid: "4F:2B:4F:A8",
      tech: [
        "android.nfc.tech.MifareClassic",
        "android.nfc.tech.NfcA",
        "android.nfc.tech.NdefFormatable",
      ],
      timestamp: Date.now(),
    });
    console.log("[NFC-DEBUG] disparando evento simulado:", payload);
    window.dispatchEvent(
      new CustomEvent("nfcResult", { detail: payload })
    );
  };

  const sm = statusMeta[status];

  return (
    <div className="min-h-screen bg-[#0a0e14] text-emerald-100 font-mono">
      <header className="border-b border-emerald-500/20 bg-[#0d1117]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            to="/"
            className="p-1.5 rounded hover:bg-emerald-500/10 text-emerald-300"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Radio className="w-4 h-4 text-emerald-400" />
          <h1 className="text-sm font-bold tracking-[0.2em] text-emerald-300">
            NFC_DEBUG://
          </h1>
          <div className="ml-auto flex items-center gap-2 text-[10px]">
            <span className={`w-2 h-2 rounded-full ${sm.dot} animate-pulse`} />
            <span className={`${sm.text} font-bold`}>{sm.label}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<Activity className="w-3.5 h-3.5" />}
            label="STATUS"
            value={sm.label}
            valueClass={sm.text}
          />
          <StatCard
            icon={<Zap className="w-3.5 h-3.5" />}
            label="EVENTS"
            value={String(count).padStart(4, "0")}
            valueClass="text-cyan-300"
          />
          <StatCard
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            label="LAST_AT"
            value={lastAt ?? "-"}
            valueClass="text-emerald-300"
          />
          <StatCard
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            label="ERRORS"
            value={error ? "YES" : "NO"}
            valueClass={error ? "text-red-400" : "text-emerald-300"}
          />
        </section>

        <button
          onClick={simulate}
          className="w-full border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors text-emerald-300 text-xs font-bold tracking-widest py-3 rounded-md uppercase flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" /> Simular Evento NFC
        </button>

        <Panel title="RAW EVENT" hint="typeof event.detail">
          <pre className="text-[11px] text-emerald-200 whitespace-pre-wrap break-all">
            {raw ?? "// nenhum evento recebido"}
          </pre>
        </Panel>

        <Panel title="PARSED JSON" hint="JSON.parse(event.detail)">
          <pre className="text-[11px] text-cyan-200 whitespace-pre-wrap break-all">
            {parsed ? JSON.stringify(parsed, null, 2) : "// aguardando..."}
          </pre>
        </Panel>

        <div className="grid sm:grid-cols-2 gap-4">
          <Panel title="UID">
            <pre className="text-sm text-yellow-300 break-all">
              {parsed?.uid ?? "-"}
            </pre>
          </Panel>
          <Panel title="TECH">
            {parsed?.tech && parsed.tech.length > 0 ? (
              <ul className="text-xs space-y-1">
                {parsed.tech.map((t, i) => (
                  <li key={`${t}-${i}`} className="text-emerald-200">
                    <span className="text-emerald-500">{">"}</span>{" "}
                    {shortTech(t)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-emerald-700">- sem tecnologias -</p>
            )}
          </Panel>
        </div>

        {typeof parsed?.timestamp === "number" && (
          <Panel title="TIMESTAMP">
            <pre className="text-[11px] text-emerald-200 break-all">
              {parsed.timestamp} ({new Date(parsed.timestamp).toLocaleString("pt-BR")})
            </pre>
          </Panel>
        )}

        <Panel title="ERROR" tone={error ? "danger" : "default"}>
          <pre className="text-[11px] whitespace-pre-wrap break-all text-red-400">
            {error ?? "// nenhum erro"}
          </pre>
        </Panel>

        <p className="text-[10px] text-emerald-700 text-center pt-2 pb-6">
          Listener: window.addEventListener("nfcResult") - expects STRING JSON via Capacitor bridge
        </p>
      </main>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) => (
  <div className="border border-emerald-500/20 bg-[#0d1117] rounded-md px-3 py-2">
    <div className="flex items-center gap-1.5 text-[9px] tracking-[0.2em] text-emerald-600">
      {icon}
      {label}
    </div>
    <div
      className={`mt-1 text-xs font-bold ${valueClass ?? "text-emerald-300"}`}
    >
      {value}
    </div>
  </div>
);

const Panel = ({
  title,
  hint,
  tone = "default",
  children,
}: {
  title: string;
  hint?: string;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) => (
  <section
    className={`rounded-md border bg-[#0d1117] ${
      tone === "danger" ? "border-red-500/30" : "border-emerald-500/20"
    }`}
  >
    <header className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/10">
      <span className="text-[10px] tracking-[0.25em] text-emerald-400 font-bold">
        {title}
      </span>
      {hint && <span className="text-[9px] text-emerald-700">{hint}</span>}
    </header>
    <div className="p-3 max-h-64 overflow-auto">{children}</div>
  </section>
);

export default NfcDebug;
