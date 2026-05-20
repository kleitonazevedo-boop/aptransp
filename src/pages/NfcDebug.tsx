import { useEffect, useState } from "react";

type NfcPayload = {
  uid?: string;
  tech?: string[];
  timestamp?: number;
};

const NfcDebug = () => {
  const [raw, setRaw] = useState<unknown>(null);
  const [parsed, setParsed] = useState<NfcPayload | null>(null);
  const [uid, setUid] = useState("");
  const [tech, setTech] = useState<string[]>([]);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (event: Event) => {
      try {
        const detail = (event as CustomEvent).detail;
        console.log("[NFC Debug] event.detail:", detail);

        setRaw(detail);
        setError("");

        const data = (detail ?? {}) as NfcPayload;
        setParsed(data);
        setUid(typeof data.uid === "string" ? data.uid : "");
        setTech(Array.isArray(data.tech) ? data.tech : []);
        setTimestamp(typeof data.timestamp === "number" ? data.timestamp : null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao ler evento");
      }
    };

    window.addEventListener("nfcResult", handler);
    return () => window.removeEventListener("nfcResult", handler);
  }, []);

  const simulate = () => {
    const payload: NfcPayload = {
      uid: "4F:2B:4F:A8",
      tech: [
        "android.nfc.tech.MifareClassic",
        "android.nfc.tech.NfcA",
        "android.nfc.tech.NdefFormatable",
      ],
      timestamp: Date.now(),
    };

    window.dispatchEvent(new CustomEvent("nfcResult", { detail: payload }));
  };

  const formatRaw = (value: unknown) => {
    if (value === null || value === undefined) return "Aguardando evento NFC";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-lg border border-emerald-500 bg-slate-900 p-4">
          <h1 className="font-mono text-xl font-bold text-emerald-300">
            NFC Debug
          </h1>
          <p className="mt-1 font-mono text-sm text-slate-400">
            Listener ativo: window.addEventListener nfcResult
          </p>
        </header>

        <button
          type="button"
          onClick={simulate}
          className="w-full rounded-lg border border-emerald-500 bg-emerald-900 px-4 py-3 font-mono text-sm font-bold text-emerald-100"
        >
          Simular Evento NFC
        </button>

        <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-mono text-sm font-bold text-emerald-300">RAW EVENT</h2>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs text-slate-200">
            {formatRaw(raw)}
          </pre>
        </section>

        <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-mono text-sm font-bold text-emerald-300">PARSED JSON</h2>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs text-slate-200">
            {parsed ? JSON.stringify(parsed, null, 2) : "Aguardando objeto"}
          </pre>
        </section>

        <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-mono text-sm font-bold text-emerald-300">UID</h2>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-sm text-yellow-300">
            {uid || "-"}
          </pre>
        </section>

        <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-mono text-sm font-bold text-emerald-300">TECH</h2>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs text-cyan-200">
            {tech.length > 0 ? tech.join("\n") : "-"}
          </pre>
        </section>

        <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-mono text-sm font-bold text-emerald-300">TIMESTAMP</h2>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs text-slate-200">
            {timestamp ? `${timestamp} (${new Date(timestamp).toISOString()})` : "-"}
          </pre>
        </section>

        <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-mono text-sm font-bold text-red-300">ERROR</h2>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs text-red-200">
            {error || "-"}
          </pre>
        </section>
      </div>
    </main>
  );
};

export default NfcDebug;
