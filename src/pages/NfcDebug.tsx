import { useEffect, useState } from "react";
import { Lock, Unlock, Database, Key } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type MifareBlock = {
  block: number;
  hex: string;
};

type AuthResult = {
  sector: number;
  authenticated: boolean;
  blocks?: MifareBlock[];
};

const isTrailerBlock = (block: number, sector: number) => {
  // Sectors 0-31: 4 blocks each, trailer is last (block % 4 === 3)
  // Sectors 32-39: 16 blocks each, trailer is last (block % 16 === 15)
  if (sector < 32) return block % 4 === 3;
  return block % 16 === 15;
};

type NfcPayload = {
  uid?: string;
  tech?: string[];
  timestamp?: number;
  mifareType?: number;
  mifareSize?: number;
  sectorCount?: number;
  blockCount?: number;
  authResults?: AuthResult[];
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
  const [authResults, setAuthResults] = useState<AuthResult[] | null>(null);
  const [authKey, setAuthKey] = useState(0);
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

        if (Array.isArray(data.authResults)) {
          console.log("AUTH RESULTS", data.authResults);
          console.log("BLOCK DUMP", data.authResults);
          setAuthResults(data.authResults);
          setAuthKey((k) => k + 1);
        } else {
          setAuthResults(null);
        }

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
      authResults: [
        {
          sector: 0,
          authenticated: true,
          blocks: [
            { block: 0, hex: "4F 2B 4F A8 BC 08 04 00 62 63 64 65 66 67 68 69" },
            { block: 1, hex: "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00" },
            { block: 2, hex: "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00" },
            { block: 3, hex: "FF FF FF FF FF FF FF 07 80 69 FF FF FF FF FF FF" },
          ],
        },
        {
          sector: 1,
          authenticated: true,
          blocks: [
            { block: 4, hex: "A1 22 FF 90 00 14 FF 22 11 00 AB CD EF 01 02 03" },
            { block: 5, hex: "00 14 FF 22 11 00 AB CD EF 01 02 03 04 05 06 07" },
            { block: 6, hex: "11 22 33 44 55 66 77 88 99 AA BB CC DD EE FF 00" },
            { block: 7, hex: "FF FF FF FF FF FF FF 07 80 69 FF FF FF FF FF FF" },
          ],
        },
        { sector: 2, authenticated: true },
        { sector: 3, authenticated: false },
        { sector: 4, authenticated: true },
        { sector: 5, authenticated: false },
        {
          sector: 16,
          authenticated: true,
          blocks: [
            { block: 64, hex: "A1 22 FF 90 00 14 FF 22 11 00 AB CD EF 01 02 03" },
            { block: 65, hex: "00 14 FF 22 11 00 AB CD EF 01 02 03 04 05 06 07" },
            { block: 67, hex: "FF FF FF FF FF FF FF 07 80 69 FF FF FF FF FF FF" },
          ],
        },
      ],
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

  const totalSectors = authResults?.length ?? 0;
  const grantedCount = authResults?.filter((r) => r.authenticated).length ?? 0;
  const deniedCount = totalSectors - grantedCount;
  const accessPercent = totalSectors > 0 ? Math.round((grantedCount / totalSectors) * 100) : 0;

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
          className="w-full rounded-lg border border-emerald-500 bg-emerald-900 px-4 py-3 font-mono text-sm font-bold text-emerald-100 active:scale-[0.98] transition-transform"
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

        <AnimatePresence>
          {authResults && authResults.length > 0 && (
            <motion.section
              key={authKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="rounded-lg border border-cyan-500/60 bg-slate-900 p-4"
            >
              <h2 className="font-mono text-sm font-bold text-cyan-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                AUTH STATUS
              </h2>

              <div className="mt-3 rounded border border-slate-700 bg-slate-950 p-3 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Resumo</span>
                  <span className="text-[10px] text-cyan-400">{accessPercent}% ACESSO</span>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <Unlock className="w-3.5 h-3.5" />
                    <span>{grantedCount} OK</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-red-400">
                    <Lock className="w-3.5 h-3.5" />
                    <span>{deniedCount} NEGADO</span>
                  </div>
                  <div className="ml-auto text-slate-300">
                    {grantedCount} / {totalSectors} setores
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${accessPercent}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="h-full rounded-full bg-emerald-500"
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 font-mono">
                <AnimatePresence>
                  {authResults.map((result, idx) => (
                    <motion.div
                      key={`${authKey}-${result.sector}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2, delay: idx * 0.03 }}
                      className={`rounded border p-2.5 ${
                        result.authenticated
                          ? "border-emerald-500/40 bg-emerald-950/30"
                          : "border-red-500/40 bg-red-950/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Sector {result.sector}</span>
                        {result.authenticated ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>
                      <div
                        className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${
                          result.authenticated ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {result.authenticated ? "ACCESS GRANTED" : "ACCESS DENIED"}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

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
