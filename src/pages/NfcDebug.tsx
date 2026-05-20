import { useEffect, useState } from "react";

type NfcPayload = {
  uid?: string;
  tech?: string[];
  timestamp?: number;
};

const NfcDebug = () => {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<NfcPayload | null>(null);
  const [uid, setUid] = useState("");
  const [tech, setTech] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const rawText = String(detail);

      setRaw(rawText);
      setError("");

      try {
        const data = JSON.parse(rawText) as NfcPayload;

        setParsed(data);
        setUid(typeof data.uid === "string" ? data.uid : "");
        setTech(Array.isArray(data.tech) ? data.tech : []);
      } catch (err) {
        setParsed(null);
        setUid("");
        setTech([]);
        setError(err instanceof Error ? err.message : "Erro ao ler JSON");
      }
    };

    window.addEventListener("nfcResult", handler);

    return () => {
      window.removeEventListener("nfcResult", handler);
    };
  }, []);

  const simulate = () => {
    const payload = {
      uid: "4F:2B:4F:A8",
      tech: [
        "android.nfc.tech.MifareClassic",
        "android.nfc.tech.NfcA",
        "android.nfc.tech.NdefFormatable",
      ],
      timestamp: Date.now(),
    };

    window.dispatchEvent(
      new CustomEvent("nfcResult", {
        detail: JSON.stringify(payload),
      })
    );
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
          <h2 className="font-mono text-sm font-bold text-emerald-300">RAW</h2>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs text-slate-200">
            {raw || "Aguardando evento NFC"}
          </pre>
        </section>

        <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-mono text-sm font-bold text-emerald-300">
            PARSED
          </h2>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs text-slate-200">
            {parsed ? JSON.stringify(parsed, null, 2) : "Aguardando JSON válido"}
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