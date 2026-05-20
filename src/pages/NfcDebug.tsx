import { useEffect, useState } from "react";

type NfcPayload = {
  uid?: string;
  tech?: string[];
  timestamp?: number;
  mifareType?: number;
  mifareSize?: number;
  sectorCount?: number;
  blockCount?: number;
};

type Status = "waiting" | "received" | "error";

const mifareTypeLabel = (type?: number) => {
  if (type === undefined || type === null) return "-";
  switch (type) {
    case 0:
      return "Classic";
    case 1:
      return "Plus";
    case 2:
      return "Pro";
    case -1:
      return "Unknown";
    default:
      return `Tipo ${type}`;
  }
};

const mifareSizeLabel = (size?: number) => {
  if (!size) return "-";
  if (size === 320) return "MIFARE Classic Mini (320B)";
  if (size === 1024) return "MIFARE Classic 1K";
  if (size === 2048) return "MIFARE Classic 2K";
  if (size === 4096) return "MIFARE Classic 4K";
  return `${size} bytes`;
};

const NfcDebug = () => {
  const [status, setStatus] = useState<Status>("waiting");
  const [raw, setRaw] = useState<unknown>(null);
  const [parsed, setParsed] = useState<NfcPayload | null>(null);
  const [uid, setUid] = useState("");
  const [tech, setTech] = useState<string[]>([]);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [mifareType, setMifareType] = useState<number | undefined>(undefined);
  const [mifareSize, setMifareSize] = useState<number | undefined>(undefined);
  const [sectorCount, setSectorCount] = useState<number | undefined>(undefined);
  const [blockCount, setBlockCount] = useState<number | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (event: Event) => {
      try {
        const detail = (event as CustomEvent).detail;
        console.log("[NFC Debug] event.detail:", detail);

        setRaw(detail);
        setError("");
        setStatus("received");

        const data = (detail ?? {}) as NfcPayload;
        setParsed(data);
        setUid(typeof data.uid === "string" ? data.uid : "");
        setTech(Array.isArray(data.tech) ? data.tech : []);
        setTimestamp(typeof data.timestamp === "number" ? data.timestamp : null);
        setMifareType(typeof data.mifareType === "number" ? data.mifareType : undefined);
        setMifareSize(typeof data.mifareSize === "number" ? data.mifareSize : undefined);
        setSectorCount(typeof data.sectorCount === "number" ? data.sectorCount : undefined);
        setBlockCount(typeof data.blockCount === "number" ? data.blockCount : undefined);

        console.log("MIFARE INFO", {
          mifareType: data.mifareType,
          mifareSize: data.mifareSize,
          sectorCount: data.sectorCount,
          blockCount: data.blockCount,
        });
      } catch (err) {
        setStatus("error");
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
      mifareType: 0,
      mifareSize: 1024,
      sectorCount: 16,
      blockCount: 64,
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

  const hasMifare = tech.some((t) => t.toLowerCase().includes("mifareclassic"));
  const statusLabel =
    status === "waiting" ? "AGUARDANDO" : status === "received" ? "EVENTO RECEBIDO" : "ERRO";
  const statusColor =
    status === "waiting"
      ? "border-slate-600 text-slate-300"
      : status === "received"
        ? "border-emerald-500 text-emerald-300"
        : "border-red-500 text-red-300";

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-lg border border-emerald-500 bg-slate-900 p-4">
          <h1 className="font-mono text-xl font-bold text-emerald-300">NFC Debug</h1>
          <p className="mt-1 font-mono text-xs text-slate-400">
            window.addEventListener("nfcResult")
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded border px-2 py-1 font-mono text-[10px] ${statusColor}`}>
              {statusLabel}
            </span>
            <span className="rounded border border-cyan-500 px-2 py-1 font-mono text-[10px] text-cyan-300">
              NFC ACTIVE
            </span>
            {hasMifare ? (
              <span className="rounded border border-yellow-500 px-2 py-1 font-mono text-[10px] text-yellow-300">
                MIFARE DETECTED
              </span>
            ) : null}
          </div>
        </header>

        <button
          type="button"
          onClick={simulate}
          className="w-full rounded-lg border border-emerald-500 bg-emerald-900 px-4 py-3 font-mono text-sm font-bold text-emerald-100"
        >
          Simular Evento NFC
        </button>

        <section className="rounded-lg border border-yellow-500/60 bg-slate-900 p-4">
          <h2 className="font-mono text-sm font-bold text-yellow-300">MIFARE INFO</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="rounded border border-slate-700 bg-slate-950 p-3">
              <div className="text-[10px] text-slate-400">TIPO MIFARE</div>
              <div className="mt-1 text-sm text-yellow-200">{mifareTypeLabel(mifareType)}</div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-950 p-3">
              <div className="text-[10px] text-slate-400">TAMANHO</div>
              <div className="mt-1 text-sm text-yellow-200">{mifareSizeLabel(mifareSize)}</div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-950 p-3">
              <div className="text-[10px] text-slate-400">SETORES</div>
              <div className="mt-1 text-sm text-cyan-200">
                {sectorCount !== undefined ? `${sectorCount} setores disponíveis` : "-"}
              </div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-950 p-3">
              <div className="text-[10px] text-slate-400">BLOCOS</div>
              <div className="mt-1 text-sm text-cyan-200">
                {blockCount !== undefined ? `${blockCount} blocos disponíveis` : "-"}
              </div>
            </div>
          </div>
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
