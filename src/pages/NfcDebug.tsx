import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Lock,
  Unlock,
  Database,
  Key,
  Download,
  Save,
  Trash2,
  Upload,
  GitCompare,
  Activity,
  FileJson,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ForensicReport from "@/components/ForensicReport";
import { getRawBlocks, normalizeAuthResults, sectorOfBlock } from "@/lib/forensic";

type MifareBlock = {
  sector?: number;
  block: number;
  hex: string;
  bytes?: number[];
  isTrailer?: boolean;
  authSuccess?: boolean;
  keyType?: string | null;
  usedDefaultKey?: boolean;
};

type AuthResult = {
  sector: number;
  authenticated: boolean;
  keyType?: string | null;
  usedDefaultKey?: boolean;
  blocks?: MifareBlock[];
};

const isTrailerBlock = (block: number, sector: number, explicit?: boolean) => {
  if (typeof explicit === "boolean") return explicit;
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
  blocks?: MifareBlock[];
  rawBlocks?: MifareBlock[];
  readOnly?: boolean;
  error?: string;
};

type Snapshot = {
  id: string;
  timestamp: number;
  uid: string;
  data: NfcPayload;
};

type Status = "waiting" | "received" | "error";

const SNAPSHOT_KEY = "nfc_debug_snapshots_v1";

const extractNfcEventPayload = (event: Event): unknown => {
  const custom = event as CustomEvent;
  if (custom.detail !== undefined && custom.detail !== null) return custom.detail;
  const eventObject = event as unknown as Record<string, unknown>;
  const keys = [
    "uid",
    "tech",
    "timestamp",
    "mifareType",
    "mifareSize",
    "sectorCount",
    "blockCount",
    "authResults",
    "blocks",
    "rawBlocks",
    "readOnly",
    "error",
  ];
  const payload = keys.reduce<Record<string, unknown>>((acc, key) => {
    if (eventObject[key] !== undefined) acc[key] = eventObject[key];
    return acc;
  }, {});
  return Object.keys(payload).length > 0 ? payload : null;
};

const normalizeNfcPayload = (value: unknown): NfcPayload => {
  const data = typeof value === "string" ? JSON.parse(value) : value;
  const obj = (data ?? {}) as NfcPayload;
  const rawBlocks = getRawBlocks(obj) as MifareBlock[];
  const authResults = normalizeAuthResults(obj) as AuthResult[];
  return {
    ...obj,
    rawBlocks,
    blocks: rawBlocks,
    authResults,
    readOnly: true,
  };
};

const mifareTypeLabel = (type?: number) => {
  if (type === undefined || type === null) return "-";
  switch (type) {
    case 0: return "Classic";
    case 1: return "Plus";
    case 2: return "Pro";
    case -1: return "Unknown";
    default: return `Tipo ${type}`;
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

const loadSnapshots = (): Snapshot[] => {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistSnapshots = (list: Snapshot[]) => {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("snapshot persist failed", e);
  }
};

const countBlocks = (s: Snapshot) => getRawBlocks(s.data).length;

const countSectors = (s: Snapshot) => normalizeAuthResults(s.data).length;

const formatTs = (ts: number) =>
  new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const isNativePlatform = (): boolean => {
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return !!w.Capacitor?.isNativePlatform?.();
};

const triggerDownload = async (
  filename: string,
  content: string,
  mime = "application/json",
  labels = {
    fileCreated: "EXPORT FILE CREATED",
    shareOpened: "EXPORT SHARE OPENED",
    error: "EXPORT ERROR",
  },
) => {
  try {
    if (isNativePlatform()) {
      const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");

      await Filesystem.writeFile({
        path: filename,
        directory: Directory.Documents,
        data: content,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      console.log(labels.fileCreated, filename);

      const fileInfo = await Filesystem.getUri({
        directory: Directory.Documents,
        path: filename,
      });

      await Share.share({
        title: "NFC Forensic Dump",
        text: filename,
        url: fileInfo.uri,
        dialogTitle: "Compartilhar dump NFC",
      });
      console.log(labels.shareOpened);
      return;
    }

    // Web fallback
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(labels.fileCreated, filename);
  } catch (error) {
    console.error(labels.error, error);
  }
};

const fileStamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

type BlockMap = Map<number, { hex: string; sector: number; isTrailer: boolean }>;

const buildBlockMap = (snap: Snapshot): BlockMap => {
  const map: BlockMap = new Map();
  normalizeAuthResults(snap.data).forEach((r) => {
    (r.blocks ?? []).forEach((b) => {
      map.set(b.block, {
        hex: b.hex,
        sector: r.sector,
        isTrailer: isTrailerBlock(b.block, r.sector, b.isTrailer),
      });
    });
  });
  return map;
};

type DiffEntry = {
  block: number;
  sector: number;
  before: string;
  after: string;
  changed: boolean;
  isTrailer: boolean;
};

const diffSnapshots = (a: Snapshot, b: Snapshot): DiffEntry[] => {
  const mapA = buildBlockMap(a);
  const mapB = buildBlockMap(b);
  const blocks = new Set<number>([...mapA.keys(), ...mapB.keys()]);
  const out: DiffEntry[] = [];
  blocks.forEach((blk) => {
    const ea = mapA.get(blk);
    const eb = mapB.get(blk);
    const before = ea?.hex ?? "—";
    const after = eb?.hex ?? "—";
    out.push({
      block: blk,
      sector: eb?.sector ?? ea?.sector ?? -1,
      before,
      after,
      changed: before !== after,
      isTrailer: ea?.isTrailer ?? eb?.isTrailer ?? false,
    });
  });
  return out.sort((x, y) => x.block - y.block);
};

const diffBytes = (a: string, b: string) => {
  const ba = a.split(/\s+/);
  const bb = b.split(/\s+/);
  const len = Math.max(ba.length, bb.length);
  return Array.from({ length: len }, (_, i) => ({
    before: ba[i] ?? "··",
    after: bb[i] ?? "··",
    changed: ba[i] !== bb[i],
  }));
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

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [diffA, setDiffA] = useState<string>("");
  const [diffB, setDiffB] = useState<string>("");

  useEffect(() => {
    setSnapshots(loadSnapshots());
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      try {
        const detail = extractNfcEventPayload(event);
        console.log("[NFC Debug] event.detail:", detail);

        setRaw(detail);
        setError("");
        setStatus("received");

        const data = normalizeNfcPayload(detail);
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
          console.log("BLOCK DUMP", data.rawBlocks ?? data.blocks ?? []);
          setAuthResults(data.authResults);
          setAuthKey((k) => k + 1);
        } else {
          setAuthResults(null);
        }
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Erro ao ler evento");
      }
    };

    window.addEventListener("nfcResult", handler);
    return () => window.removeEventListener("nfcResult", handler);
  }, []);

  const simulate = () => {
    const variation = Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase();
    const payload: NfcPayload = {
      uid: "4F:2B:4F:A8",
      tech: [
        "android.nfc.tech.MifareClassic",
        "android.nfc.tech.NfcA",
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
            { block: 3, hex: "FF FF FF FF FF FF FF 07 80 69 FF FF FF FF FF FF", isTrailer: true },
          ],
        },
        {
          sector: 1,
          authenticated: true,
          blocks: [
            { block: 4, hex: "A1 22 FF 90 00 14 FF 22 11 00 AB CD EF 01 02 03" },
            { block: 5, hex: `00 14 FF 22 11 00 AB CD EF 01 02 03 04 05 06 ${variation}` },
            { block: 6, hex: "11 22 33 44 55 66 77 88 99 AA BB CC DD EE FF 00" },
            { block: 7, hex: "FF FF FF FF FF FF FF 07 80 69 FF FF FF FF FF FF", isTrailer: true },
          ],
        },
        { sector: 2, authenticated: true },
        { sector: 3, authenticated: false },
        {
          sector: 16,
          authenticated: true,
          blocks: [
            { block: 64, hex: `A1 22 FF 90 00 14 FF 22 11 00 AB CD EF 01 02 ${variation}` },
            { block: 65, hex: "00 14 FF 22 11 00 AB CD EF 01 02 03 04 05 06 07" },
            { block: 67, hex: "FF FF FF FF FF FF FF 07 80 69 FF FF FF FF FF FF", isTrailer: true },
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

  function buildForensicDumpPayload(snapshot?: Snapshot) {
    const source = snapshot?.data ?? parsed;
    const sourceAuth = normalizeAuthResults(source) as AuthResult[];
    const rawBlocks = getRawBlocks(source) as MifareBlock[];
    const hexDump = sourceAuth.flatMap((r) =>
      (r.blocks ?? []).map((b) => ({
        sector: r.sector,
        block: b.block,
        hex: b.hex,
        bytes: b.bytes ?? b.hex.match(/[0-9a-fA-F]{2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
        isTrailer: isTrailerBlock(b.block, r.sector, b.isTrailer),
        type: isTrailerBlock(b.block, r.sector, b.isTrailer) ? "trailer" : "data",
        authSuccess: b.authSuccess ?? r.authenticated,
        keyType: b.keyType ?? r.keyType ?? null,
      })),
    );
    const validSectors = sourceAuth.filter((r) => r.authenticated).map((r) => r.sector);

    return {
      uid: snapshot?.uid ?? uid,
      timestamp: snapshot?.timestamp ?? timestamp ?? Date.now(),
      authState: {
        totalSectors: sourceAuth.length,
        authenticatedSectors: validSectors.length,
        deniedSectors: sourceAuth.filter((r) => !r.authenticated).map((r) => r.sector),
        accessPercent: sourceAuth.length > 0 ? Math.round((validSectors.length / sourceAuth.length) * 100) : 0,
      },
      validSectors,
      blocksRead: hexDump.length,
      rawBlocks: rawBlocks.map((b) => ({
        sector: b.sector ?? sectorOfBlock(b.block),
        block: b.block,
        hex: b.hex,
      })),
      blocks: hexDump,
      diffData: {
        snapshotA: snapA ? { id: snapA.id, timestamp: snapA.timestamp, uid: snapA.uid } : null,
        snapshotB: snapB ? { id: snapB.id, timestamp: snapB.timestamp, uid: snapB.uid } : null,
        changedBlocks: diffEntries.filter((d) => d.changed),
        unchangedBlocks: diffEntries.filter((d) => !d.changed),
      },
      forensicMetadata: {
        generatedAt: new Date().toISOString(),
        source: "nfc-debug",
        exportFormat: "forensic-snapshot-v1",
        platform: isNativePlatform() ? "capacitor" : "web",
      },
      mifareInfo: {
        mifareType: source?.mifareType ?? mifareType,
        mifareTypeLabel: mifareTypeLabel(source?.mifareType ?? mifareType),
        mifareSize: source?.mifareSize ?? mifareSize,
        mifareSizeLabel: mifareSizeLabel(source?.mifareSize ?? mifareSize),
        sectorCount: source?.sectorCount ?? sectorCount,
        blockCount: source?.blockCount ?? blockCount,
        tech: source?.tech ?? tech,
      },
      readOnly: true,
      authResults: sourceAuth,
      rawEvent: raw,
      snapshotData: source,
    };
  }

  const handleExportTxt = async () => {
    const rawText = formatRaw(raw);
    const parsedText = parsed ? JSON.stringify(parsed, null, 2) : "Aguardando objeto";
    const content = [
      "=============================================",
      "          NFC DEBUG EXPORT — TXT",
      "=============================================",
      "",
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      `UID: ${uid || "-"}`,
      `Tech: ${tech.length > 0 ? tech.join(", ") : "-"}`,
      `Timestamp: ${timestamp ? `${timestamp} (${new Date(timestamp).toISOString()})` : "-"}`,
      "",
      "--- RAW EVENT ---",
      rawText,
      "",
      "--- PARSED JSON ---",
      parsedText,
    ].join("\n");
    await triggerDownload(`nfc-debug-${fileStamp()}.txt`, content, "text/plain");
  };

  const handleExportJson = async () => {
    if (!parsed) return;
    const dump = buildForensicDumpPayload();
    await triggerDownload(`dump_${fileStamp()}.json`, JSON.stringify(dump, null, 2));
    console.log("EXPORT GENERATED");
  };

  const handleSaveSnapshot = async () => {
    if (!parsed) return;
    const rawBlocks = getRawBlocks(parsed) as MifareBlock[];
    const normalizedAuth = normalizeAuthResults(parsed) as AuthResult[];
    const snap: Snapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      uid: uid || "-",
      data: { ...parsed, rawBlocks, blocks: rawBlocks, authResults: normalizedAuth, readOnly: true },
    };
    const next = [snap, ...snapshots].slice(0, 50);
    setSnapshots(next);
    persistSnapshots(next);
    console.log("SNAPSHOT SAVED", snap);
    const snapshotDump = buildForensicDumpPayload(snap);
    await triggerDownload(
      `snapshot_${fileStamp()}.json`,
      JSON.stringify(snapshotDump, null, 2),
      "application/json",
      {
        fileCreated: "SNAPSHOT FILE CREATED",
        shareOpened: "SNAPSHOT SHARE OPENED",
        error: "SNAPSHOT EXPORT ERROR",
      },
    );
    console.log("SNAPSHOT SAVED", snap);
  };

  const handleLoadSnapshot = (id: string) => {
    const snap = snapshots.find((s) => s.id === id);
    if (!snap) return;
    window.dispatchEvent(new CustomEvent("nfcResult", { detail: snap.data }));
  };

  const handleDeleteSnapshot = (id: string) => {
    const next = snapshots.filter((s) => s.id !== id);
    setSnapshots(next);
    persistSnapshots(next);
  };

  const snapA = useMemo(() => snapshots.find((s) => s.id === diffA), [snapshots, diffA]);
  const snapB = useMemo(() => snapshots.find((s) => s.id === diffB), [snapshots, diffB]);
  const diffEntries = useMemo(
    () => (snapA && snapB ? diffSnapshots(snapA, snapB) : []),
    [snapA, snapB],
  );
  const changedCount = diffEntries.filter((d) => d.changed).length;
  const diffPercent = diffEntries.length > 0
    ? Math.round((changedCount / diffEntries.length) * 100)
    : 0;

  const handleExportDiff = async () => {
    if (!snapA || !snapB) return;
    const payload = {
      snapshotA: { id: snapA.id, timestamp: snapA.timestamp, uid: snapA.uid },
      snapshotB: { id: snapB.id, timestamp: snapB.timestamp, uid: snapB.uid },
      changedBlocks: diffEntries.filter((d) => d.changed),
      unchangedBlocks: diffEntries.filter((d) => !d.changed),
    };
    await triggerDownload(`diff_${fileStamp()}.json`, JSON.stringify(payload, null, 2));
    console.log("DIFF GENERATED");
  };

  // Variable block analyzer — across all snapshots
  const variableAnalysis = useMemo(() => {
    const seen = new Map<number, { values: Set<string>; sector: number; isTrailer: boolean; total: number }>();
    snapshots.forEach((snap) => {
      (snap.data.authResults ?? []).forEach((r) => {
        (r.blocks ?? []).forEach((b) => {
          const cur = seen.get(b.block) ?? {
            values: new Set<string>(),
            sector: r.sector,
            isTrailer: isTrailerBlock(b.block, r.sector, b.isTrailer),
            total: 0,
          };
          cur.values.add(b.hex);
          cur.total += 1;
          seen.set(b.block, cur);
        });
      });
    });
    const rows = Array.from(seen.entries()).map(([block, info]) => {
      const changes = Math.max(0, info.values.size - 1);
      const percent = info.total > 0 ? Math.round((changes / info.total) * 100) : 0;
      let level: "STATIC" | "LOW CHANGE" | "HIGH CHANGE" = "STATIC";
      if (changes > 0 && changes <= 2) level = "LOW CHANGE";
      if (changes > 2) level = "HIGH CHANGE";
      return { block, sector: info.sector, isTrailer: info.isTrailer, changes, total: info.total, percent, level };
    });
    return rows.sort((a, b) => b.changes - a.changes);
  }, [snapshots]);

  const maxChanges = variableAnalysis[0]?.changes ?? 0;

  const statusLabel =
    status === "waiting" ? "AGUARDANDO" : status === "received" ? "EVENTO RECEBIDO" : "ERRO";
  const statusColor =
    status === "waiting"
      ? "border-slate-600 text-slate-300"
      : status === "received"
        ? "border-emerald-500 text-emerald-300"
        : "border-red-500 text-red-300";

  return (
    <>
      <Helmet>
        <title>NFC Debug — Forensic Lab | aptransp</title>
        <meta name="description" content="Ferramenta forense NFC para análise técnica de cartões MIFARE. Dump de blocos, snapshots, diff e exportação de dados em tempo real." />
        <link rel="canonical" href="https://bilhete-tap-reader.lovable.app/nfc-debug" />
      </Helmet>
      <main className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-lg border border-emerald-500 bg-slate-900 p-4">
          <h1 className="font-mono text-xl font-bold text-emerald-300">NFC Debug // Forensic</h1>
          <p className="mt-1 font-mono text-xs text-slate-400">
            window.addEventListener("nfcResult") — READ ONLY
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
            <span className="rounded border border-red-500/60 px-2 py-1 font-mono text-[10px] text-red-300">
              READ-ONLY MODE
            </span>
          </div>
        </header>

        <button
          type="button"
          onClick={simulate}
          className="w-full rounded-lg border border-emerald-500 bg-emerald-900 px-4 py-3 font-mono text-sm font-bold text-emerald-100 active:scale-[0.98] transition-transform"
        >
          Simular Evento NFC
        </button>

        {/* EXPORT CENTER */}
        <section className="rounded-lg border border-cyan-500/60 bg-slate-900 p-4">
          <h2 className="font-mono text-sm font-bold text-cyan-300 flex items-center gap-2">
            <FileJson className="w-4 h-4" /> EXPORT CENTER
            <span className="ml-auto inline-flex items-center gap-1 rounded border border-emerald-500/70 bg-emerald-900/40 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-300 tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              EXPORT READY
            </span>
          </h2>
          <p className="mt-1 font-mono text-[10px] text-slate-400">
            Exportação forensic — Capacitor Filesystem + Share (Android nativo)
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              disabled={!parsed}
              className="flex items-center justify-center gap-2 rounded-lg border border-cyan-500 bg-cyan-900/40 px-3 py-2.5 font-mono text-xs font-bold text-cyan-100 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:pointer-events-none"
            >
              <Download className="w-4 h-4" />
              EXPORT FULL DUMP (JSON)
            </button>
            <button
              type="button"
              onClick={handleExportTxt}
              disabled={!raw && !parsed}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-500 bg-slate-800/60 px-3 py-2.5 font-mono text-xs font-bold text-slate-100 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:pointer-events-none"
            >
              <Download className="w-4 h-4" />
              EXPORT (TXT)
            </button>
            <button
              type="button"
              onClick={handleSaveSnapshot}
              disabled={!parsed}
              className="flex items-center justify-center gap-2 rounded-lg border border-fuchsia-500 bg-fuchsia-900/40 px-3 py-2.5 font-mono text-xs font-bold text-fuchsia-100 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:pointer-events-none sm:col-span-2"
            >
              <Save className="w-4 h-4" />
              SAVE SNAPSHOT
            </button>
          </div>
        </section>

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
                {sectorCount !== undefined ? `${sectorCount} setores` : "-"}
              </div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-950 p-3">
              <div className="text-[10px] text-slate-400">BLOCOS</div>
              <div className="mt-1 text-sm text-cyan-200">
                {blockCount !== undefined ? `${blockCount} blocos` : "-"}
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
                        {result.authenticated ? "GRANTED" : "DENIED"}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {authResults && authResults.some((r) => r.blocks && r.blocks.length > 0) && (
            <motion.section
              key={`dump-${authKey}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="rounded-lg border border-fuchsia-500/60 bg-slate-900 p-4"
            >
              <h2 className="font-mono text-sm font-bold text-fuchsia-300 flex items-center gap-2">
                <Database className="w-4 h-4" />
                BLOCK DUMP
                <span className="ml-auto rounded border border-emerald-500 px-1.5 py-0.5 text-[9px] text-emerald-300">
                  READ OK
                </span>
              </h2>
              <p className="mt-1 font-mono text-[10px] text-slate-400">
                Dump HEX dos blocos MIFARE autenticados
              </p>

              <div className="mt-3 space-y-3">
                {authResults
                  .filter((r) => r.blocks && r.blocks.length > 0)
                  .map((result, idx) => (
                    <motion.div
                      key={`${authKey}-dump-${result.sector}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.05 }}
                      className="rounded border border-slate-700 bg-slate-950 overflow-hidden"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-3 py-2 font-mono">
                        <div className="flex items-center gap-2">
                          <Key className="w-3.5 h-3.5 text-fuchsia-400" />
                          <span className="text-xs font-bold text-fuchsia-300">
                            Sector {result.sector}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {result.blocks?.length} blocks
                        </span>
                      </div>

                      <div className="divide-y divide-slate-800/60">
                        {result.blocks!.map((b) => {
                          const trailer = isTrailerBlock(b.block, result.sector, b.isTrailer);
                          return (
                            <div
                              key={`${result.sector}-${b.block}`}
                              className={`px-3 py-2 font-mono ${trailer ? "bg-yellow-950/20" : ""}`}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-[10px] font-bold tracking-wider ${
                                    trailer ? "text-yellow-300" : "text-cyan-300"
                                  }`}
                                >
                                  Block {b.block}
                                </span>
                                <span
                                  className={`text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${
                                    trailer
                                      ? "border-yellow-500/60 text-yellow-300"
                                      : "border-slate-700 text-slate-400"
                                  }`}
                                >
                                  {trailer ? "TRAILER" : "DATA"}
                                </span>
                              </div>
                              <div
                                className={`mt-1 text-[11px] break-all leading-relaxed ${
                                  trailer ? "text-yellow-200" : "text-emerald-300"
                                }`}
                              >
                                {b.hex}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* SNAPSHOT HISTORY */}
        <section className="rounded-lg border border-fuchsia-500/60 bg-slate-900 p-4">
          <h2 className="font-mono text-sm font-bold text-fuchsia-300 flex items-center gap-2">
            <Save className="w-4 h-4" />
            SNAPSHOT HISTORY
            <span className="ml-auto rounded border border-fuchsia-500/60 px-1.5 py-0.5 text-[9px] text-fuchsia-200">
              {snapshots.length} SAVED
            </span>
          </h2>
          {snapshots.length === 0 ? (
            <p className="mt-3 font-mono text-[11px] text-slate-500">
              Nenhum snapshot salvo. Use SAVE SNAPSHOT após receber um evento.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 font-mono">
              {snapshots.map((s) => (
                <li
                  key={s.id}
                  className="rounded border border-slate-700 bg-slate-950 p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-fuchsia-300 font-bold">{formatTs(s.timestamp)}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-cyan-300">UID {s.uid}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    {countSectors(s)} setores · {countBlocks(s)} blocos
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoadSnapshot(s.id)}
                      className="flex items-center gap-1 rounded border border-emerald-500/60 bg-emerald-900/40 px-2 py-1 text-[10px] text-emerald-200 active:scale-95"
                    >
                      <Upload className="w-3 h-3" /> LOAD
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiffA(s.id)}
                      className={`rounded border px-2 py-1 text-[10px] active:scale-95 ${
                        diffA === s.id
                          ? "border-cyan-400 bg-cyan-900/50 text-cyan-100"
                          : "border-cyan-500/40 text-cyan-300"
                      }`}
                    >
                      SET A
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiffB(s.id)}
                      className={`rounded border px-2 py-1 text-[10px] active:scale-95 ${
                        diffB === s.id
                          ? "border-yellow-400 bg-yellow-900/50 text-yellow-100"
                          : "border-yellow-500/40 text-yellow-300"
                      }`}
                    >
                      SET B
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSnapshot(s.id)}
                      className="ml-auto flex items-center gap-1 rounded border border-red-500/60 bg-red-900/30 px-2 py-1 text-[10px] text-red-200 active:scale-95"
                    >
                      <Trash2 className="w-3 h-3" /> DELETE
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* SNAPSHOT DIFF */}
        <section className="rounded-lg border border-cyan-500/60 bg-slate-900 p-4">
          <h2 className="font-mono text-sm font-bold text-cyan-300 flex items-center gap-2">
            <GitCompare className="w-4 h-4" />
            SNAPSHOT DIFF
            {snapA && snapB && (
              <span className="ml-auto rounded border border-cyan-500 px-1.5 py-0.5 text-[9px] text-cyan-200">
                {changedCount} CHANGED · {diffPercent}%
              </span>
            )}
          </h2>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="rounded border border-cyan-500/40 bg-slate-950 p-2">
              <div className="text-[9px] text-slate-400 uppercase">Snapshot A</div>
              <div className="text-cyan-200 truncate">
                {snapA ? `${formatTs(snapA.timestamp)} · ${snapA.uid}` : "—"}
              </div>
            </div>
            <div className="rounded border border-yellow-500/40 bg-slate-950 p-2">
              <div className="text-[9px] text-slate-400 uppercase">Snapshot B</div>
              <div className="text-yellow-200 truncate">
                {snapB ? `${formatTs(snapB.timestamp)} · ${snapB.uid}` : "—"}
              </div>
            </div>
          </div>

          {snapA && snapB ? (
            <>
              <button
                type="button"
                onClick={handleExportDiff}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-cyan-500 bg-cyan-900/40 px-3 py-2 font-mono text-xs font-bold text-cyan-100 active:scale-[0.98] transition-transform"
              >
                <Download className="w-4 h-4" /> EXPORT DIFF JSON
              </button>

              <div className="mt-3 space-y-2 font-mono">
                {diffEntries.map((d) => {
                  const bytes = diffBytes(d.before, d.after);
                  return (
                    <div
                      key={d.block}
                      className={`rounded border p-2.5 text-[11px] ${
                        d.changed
                          ? "border-red-500/60 bg-red-950/20"
                          : "border-slate-700 bg-slate-950"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={d.changed ? "text-red-200 font-bold" : "text-slate-400"}>
                          Sector {d.sector} · Block {d.block}
                          {d.isTrailer && (
                            <span className="ml-2 text-[9px] text-yellow-300">TRAILER</span>
                          )}
                        </span>
                        <span
                          className={`text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${
                            d.changed
                              ? "border-red-500/60 text-red-300"
                              : "border-emerald-500/40 text-emerald-300"
                          }`}
                        >
                          {d.changed ? "CHANGED" : "UNCHANGED"}
                        </span>
                      </div>
                      {d.changed && (
                        <div className="mt-2 space-y-1">
                          <div className="text-[9px] text-slate-400">ANTES</div>
                          <div className="flex flex-wrap gap-1">
                            {bytes.map((b, i) => (
                              <span
                                key={`a-${i}`}
                                className={`px-1 rounded ${
                                  b.changed
                                    ? "bg-red-900/60 text-red-200"
                                    : "text-slate-300"
                                }`}
                              >
                                {b.before}
                              </span>
                            ))}
                          </div>
                          <div className="text-[9px] text-slate-400 mt-1">DEPOIS</div>
                          <div className="flex flex-wrap gap-1">
                            {bytes.map((b, i) => (
                              <span
                                key={`b-${i}`}
                                className={`px-1 rounded ${
                                  b.changed
                                    ? "bg-emerald-900/60 text-emerald-200"
                                    : "text-slate-300"
                                }`}
                              >
                                {b.after}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="mt-3 font-mono text-[11px] text-slate-500">
              Selecione SET A e SET B na lista de snapshots para comparar.
            </p>
          )}
        </section>

        {/* VARIABLE BLOCK ANALYZER */}
        <section className="rounded-lg border border-emerald-500/60 bg-slate-900 p-4">
          <h2 className="font-mono text-sm font-bold text-emerald-300 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            VARIABLE BLOCK ANALYZER
            <span className="ml-auto rounded border border-emerald-500/60 px-1.5 py-0.5 text-[9px] text-emerald-200">
              {snapshots.length} SAMPLES
            </span>
          </h2>
          <p className="mt-1 font-mono text-[10px] text-slate-400">
            Ranking de blocos por frequência de mudança entre snapshots
          </p>

          {variableAnalysis.length === 0 ? (
            <p className="mt-3 font-mono text-[11px] text-slate-500">
              Salve ao menos 2 snapshots para análise.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 font-mono">
              {variableAnalysis.slice(0, 20).map((row) => {
                const barPct =
                  maxChanges > 0 ? Math.max(4, Math.round((row.changes / maxChanges) * 100)) : 0;
                const levelClass =
                  row.level === "HIGH CHANGE"
                    ? "border-red-500/60 text-red-300 bg-red-950/30"
                    : row.level === "LOW CHANGE"
                      ? "border-yellow-500/60 text-yellow-300 bg-yellow-950/30"
                      : "border-slate-600 text-slate-400 bg-slate-950";
                return (
                  <li
                    key={row.block}
                    className="rounded border border-slate-700 bg-slate-950 p-2.5 text-[11px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-cyan-200 font-bold">
                        Block {row.block}{" "}
                        <span className="text-slate-500 font-normal">· Sector {row.sector}</span>
                        {row.isTrailer && (
                          <span className="ml-2 text-[9px] text-yellow-300">TRAILER</span>
                        )}
                      </span>
                      <span
                        className={`text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${levelClass}`}
                      >
                        {row.level}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      Mudou {row.changes} vez(es) · {row.total} amostras · {row.percent}%
                      {row.level === "HIGH CHANGE" && !row.isTrailer && (
                        <span className="ml-2 text-emerald-300">
                          ⓘ possível saldo/contador
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          row.level === "HIGH CHANGE"
                            ? "bg-red-500"
                            : row.level === "LOW CHANGE"
                              ? "bg-yellow-500"
                              : "bg-slate-600"
                        }`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* FORENSIC ANALYZER MODULE */}
        <ForensicReport
          parsed={parsed}
          snapshots={snapshots}
          diff={snapA && snapB ? diffEntries : null}
        />

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
    </>
  );
};

export default NfcDebug;
