// FORENSIC ANALYZER ENGINE
// Pure functions for parsing, analyzing, scoring and fingerprinting
// MIFARE Classic dumps captured via the Android Capacitor bridge.
// READ ONLY — no card mutation, no emulation, no write paths.

export type MifareBlock = {
  sector?: number;
  block: number;
  hex: string;
  bytes?: number[];
  isTrailer?: boolean;
  authSuccess?: boolean;
  keyType?: string | null;
};

export type AuthResult = {
  sector: number;
  authenticated: boolean;
  keyType?: string | null;
  usedDefaultKey?: boolean;
  blocks?: MifareBlock[];
};

export type NfcPayload = {
  uid?: string;
  tech?: string[];
  timestamp?: number;
  mifareType?: number;
  mifareSize?: number;
  sectorCount?: number;
  blockCount?: number;
  authResults?: AuthResult[];
  // Android may also send a flat top-level `blocks` array (read-only HEX dump)
  // without auth grouping. We synthesize sectors from block numbers in that case.
  blocks?: MifareBlock[];
  rawBlocks?: MifareBlock[];
  readOnly?: boolean;
};

export const sectorOfBlock = (block: number): number =>
  block < 128 ? Math.floor(block / 4) : 32 + Math.floor((block - 128) / 16);

export type Snapshot = {
  id: string;
  timestamp: number;
  uid: string;
  data: NfcPayload;
};

export const isTrailerBlock = (block: number, sector: number, explicit?: boolean) => {
  if (typeof explicit === "boolean") return explicit;
  if (sector < 32) return block % 4 === 3;
  return block % 16 === 15;
};

// ---------- PARSER ----------

export type ParsedBlock = {
  sector: number;
  block: number;
  hex: string;
  bytes: number[];
  isTrailer: boolean;
  ascii: string;
  isEmpty: boolean;
};

const hexToBytes = (hex: string): number[] => {
  if (!hex) return [];
  return hex
    .trim()
    .split(/\s+/)
    .map((b) => parseInt(b, 16))
    .filter((n) => !Number.isNaN(n));
};

const bytesToAscii = (bytes: number[]): string =>
  bytes
    .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : "."))
    .join("");

const normalizeHex = (hex: string): string =>
  (hex.match(/[0-9a-fA-F]{2}/g) ?? []).map((b) => b.toUpperCase()).join(" ");

const normalizeBlock = (b: MifareBlock, fallbackSector?: number): MifareBlock => {
  const sector = typeof b.sector === "number" ? b.sector : fallbackSector ?? sectorOfBlock(b.block);
  const hex = b.hex ? normalizeHex(b.hex) : (b.bytes ?? []).map((x) => x.toString(16).padStart(2, "0").toUpperCase()).join(" ");
  return {
    ...b,
    sector,
    hex,
    isTrailer: isTrailerBlock(b.block, sector, b.isTrailer),
  };
};

export const getRawBlocks = (payload: NfcPayload | null | undefined): MifareBlock[] => {
  if (!payload) return [];
  const byBlock = new Map<number, MifareBlock>();
  const add = (block: MifareBlock, sector?: number) => {
    if (typeof block?.block !== "number") return;
    const normalized = normalizeBlock(block, sector);
    if (!normalized.hex) return;
    byBlock.set(normalized.block, normalized);
  };
  payload.authResults?.forEach((r) => (r.blocks ?? []).forEach((b) => add(b, r.sector)));
  payload.rawBlocks?.forEach((b) => add(b, b.sector));
  payload.blocks?.forEach((b) => add(b, b.sector));
  return Array.from(byBlock.values()).sort((a, b) => a.block - b.block);
};

export const normalizeAuthResults = (payload: NfcPayload | null | undefined): AuthResult[] => {
  if (!payload) return [];
  const map = new Map<number, AuthResult>();
  payload.authResults?.forEach((r) => {
    map.set(r.sector, {
      ...r,
      keyType: r.keyType ?? null,
      usedDefaultKey: !!r.usedDefaultKey,
      blocks: (r.blocks ?? []).map((b) => normalizeBlock(b, r.sector)),
    });
  });
  getRawBlocks(payload).forEach((b) => {
    const sector = b.sector ?? sectorOfBlock(b.block);
    const cur = map.get(sector) ?? {
      sector,
      authenticated: true,
      keyType: b.keyType ?? null,
      usedDefaultKey: false,
      blocks: [],
    };
    if (!cur.blocks?.some((existing) => existing.block === b.block)) {
      cur.blocks = [...(cur.blocks ?? []), normalizeBlock(b, sector)];
    }
    if (b.authSuccess !== false) cur.authenticated = true;
    map.set(sector, cur);
  });
  return Array.from(map.values()).sort((a, b) => a.sector - b.sector);
};

export const parseDump = (payload: NfcPayload | null | undefined): ParsedBlock[] => {
  if (!payload) return [];
  const out: ParsedBlock[] = [];

  const pushBlock = (sector: number, b: MifareBlock) => {
    const bytes = hexToBytes(b.hex);
    out.push({
      sector,
      block: b.block,
      hex: b.hex,
      bytes,
      isTrailer: isTrailerBlock(b.block, sector, b.isTrailer),
      ascii: bytesToAscii(bytes),
      isEmpty: bytes.length > 0 && bytes.every((x) => x === 0),
    });
  };

  normalizeAuthResults(payload).forEach((r) => (r.blocks ?? []).forEach((b) => pushBlock(r.sector, b)));
  return out.sort((a, b) => a.block - b.block);
};

// ---------- CARD TYPE ----------

export const detectCardType = (payload: NfcPayload | null | undefined): string => {
  const size = payload?.mifareSize;
  if (size === 320) return "MIFARE Classic Mini (320B)";
  if (size === 1024) return "MIFARE Classic 1K";
  if (size === 2048) return "MIFARE Classic 2K";
  if (size === 4096) return "MIFARE Classic 4K";
  const tech = (payload?.tech ?? []).join(" ").toLowerCase();
  if (tech.includes("mifareclassic")) return "MIFARE Classic (size unknown)";
  if (tech.includes("isodep")) return "ISO-DEP (MIFARE DESFire?)";
  if (tech.includes("nfca")) return "NFC-A Tag";
  return "Unknown";
};

// ---------- ACCESS BITS / KEYS ----------

const DEFAULT_KEYS = [
  "FF FF FF FF FF FF",
  "A0 A1 A2 A3 A4 A5",
  "D3 F7 D3 F7 D3 F7",
  "00 00 00 00 00 00",
  "B0 B1 B2 B3 B4 B5",
  "4D 3A 99 C3 51 DD",
  "1A 98 2C 7E 45 9A",
];

export type TrailerAnalysis = {
  sector: number;
  block: number;
  keyA: string;
  keyB: string;
  accessBits: string;
  keyAIsDefault: boolean;
  keyBIsDefault: boolean;
  matchedKeyAName: string | null;
  matchedKeyBName: string | null;
};

const DEFAULT_KEY_NAMES: Record<string, string> = {
  "FFFFFFFFFFFF": "MFC default",
  "A0A1A2A3A4A5": "MAD key",
  "D3F7D3F7D3F7": "NDEF key",
  "000000000000": "blank",
  "B0B1B2B3B4B5": "transport",
  "4D3A99C351DD": "Infineon",
  "1A982C7E459A": "common",
};

const normalize = (hex: string) => hex.replace(/\s+/g, "").toUpperCase();

export const analyzeTrailer = (b: ParsedBlock): TrailerAnalysis | null => {
  if (!b.isTrailer || b.bytes.length < 16) return null;
  const keyA = b.bytes.slice(0, 6).map((x) => x.toString(16).padStart(2, "0").toUpperCase()).join(" ");
  const access = b.bytes.slice(6, 10).map((x) => x.toString(16).padStart(2, "0").toUpperCase()).join(" ");
  const keyB = b.bytes.slice(10, 16).map((x) => x.toString(16).padStart(2, "0").toUpperCase()).join(" ");
  const defaults = new Set(DEFAULT_KEYS.map(normalize));
  return {
    sector: b.sector,
    block: b.block,
    keyA,
    keyB,
    accessBits: access,
    keyAIsDefault: defaults.has(normalize(keyA)),
    keyBIsDefault: defaults.has(normalize(keyB)),
    matchedKeyAName: DEFAULT_KEY_NAMES[normalize(keyA)] ?? null,
    matchedKeyBName: DEFAULT_KEY_NAMES[normalize(keyB)] ?? null,
  };
};

// ---------- ENTROPY ----------

export const shannonEntropy = (bytes: number[]): number => {
  if (bytes.length === 0) return 0;
  const counts = new Array(256).fill(0) as number[];
  bytes.forEach((b) => (counts[b] += 1));
  let h = 0;
  counts.forEach((c) => {
    if (c === 0) return;
    const p = c / bytes.length;
    h -= p * Math.log2(p);
  });
  return h; // 0..8
};

// ---------- VARIABILITY ----------

export type Variability = "STATIC" | "VARIABLE" | "HIGH CHANGE";

export type VariableBlockRow = {
  block: number;
  sector: number;
  isTrailer: boolean;
  changes: number;
  total: number;
  percent: number;
  level: Variability;
};

export const analyzeVariability = (snapshots: Snapshot[]): VariableBlockRow[] => {
  const seen = new Map<
    number,
    { values: Set<string>; sector: number; isTrailer: boolean; total: number }
  >();
  snapshots.forEach((snap) => {
    normalizeAuthResults(snap.data).forEach((r) => {
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
  return Array.from(seen.entries())
    .map(([block, info]) => {
      const changes = Math.max(0, info.values.size - 1);
      const percent = info.total > 0 ? Math.round((changes / info.total) * 100) : 0;
      let level: Variability = "STATIC";
      if (changes > 0 && changes <= 2) level = "VARIABLE";
      if (changes > 2) level = "HIGH CHANGE";
      return {
        block,
        sector: info.sector,
        isTrailer: info.isTrailer,
        changes,
        total: info.total,
        percent,
        level,
      };
    })
    .sort((a, b) => b.changes - a.changes);
};

// ---------- SECURITY ----------

export type SecurityAnalysis = {
  totalSectors: number;
  openSectors: number[];
  defaultKeySectors: number[];
  writableSectorsSuspect: number[];
  weakKeys: number;
  score: number; // 0..100 (higher = safer)
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  findings: string[];
};

export const analyzeSecurity = (
  payload: NfcPayload | null | undefined,
  blocks: ParsedBlock[],
): SecurityAnalysis => {
  const authResults = normalizeAuthResults(payload);
  const trailers = blocks.filter((b) => b.isTrailer).map(analyzeTrailer).filter(Boolean) as TrailerAnalysis[];
  const openSectors = authResults.filter((r) => r.authenticated).map((r) => r.sector);
  const defaultKeySectors = trailers
    .filter((t) => t.keyAIsDefault || t.keyBIsDefault)
    .map((t) => t.sector);
  // Suspect writable: access bits == FF 07 80 (transport/default ACL)
  const writableSectorsSuspect = trailers
    .filter((t) => normalize(t.accessBits).startsWith("FF0780"))
    .map((t) => t.sector);
  const weakKeys = trailers.reduce(
    (acc, t) => acc + (t.keyAIsDefault ? 1 : 0) + (t.keyBIsDefault ? 1 : 0),
    0,
  );

  const findings: string[] = [];
  if (defaultKeySectors.length > 0)
    findings.push(`${defaultKeySectors.length} setor(es) com chave padrão (MFC default / NDEF / transport).`);
  if (writableSectorsSuspect.length > 0)
    findings.push(`${writableSectorsSuspect.length} setor(es) com ACL permissiva (FF 07 80) — possivelmente graváveis.`);
  if (openSectors.length === authResults.length && authResults.length > 0)
    findings.push("Todos os setores autenticam com chave conhecida.");
  if (trailers.length === 0) findings.push("Nenhum trailer block disponível para inspeção.");

  let score = 100;
  score -= defaultKeySectors.length * 6;
  score -= writableSectorsSuspect.length * 4;
  score -= weakKeys * 2;
  score = Math.max(0, Math.min(100, score));

  let risk: SecurityAnalysis["risk"] = "LOW";
  if (score < 80) risk = "MEDIUM";
  if (score < 55) risk = "HIGH";
  if (score < 30) risk = "CRITICAL";

  return {
    totalSectors: authResults.length,
    openSectors,
    defaultKeySectors,
    writableSectorsSuspect,
    weakKeys,
    score,
    risk,
    findings,
  };
};

// ---------- FINGERPRINT ----------

export const sha256Hex = async (input: string): Promise<string> => {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export type Fingerprint = {
  uid: string;
  dumpHash: string;
  cardSignature: string;
  snapshotHash: string;
  generatedAt: string;
};

export const generateFingerprint = async (
  payload: NfcPayload | null | undefined,
  blocks: ParsedBlock[],
): Promise<Fingerprint> => {
  const dumpString = blocks.map((b) => `${b.block}:${b.hex}`).join("|");
  const dumpHash = await sha256Hex(dumpString || "(empty)");
  const cardSignature = await sha256Hex(
    `${payload?.uid ?? ""}|${(payload?.tech ?? []).join(",")}|${payload?.mifareSize ?? ""}`,
  );
  const snapshotHash = await sha256Hex(JSON.stringify(payload ?? {}));
  return {
    uid: payload?.uid ?? "-",
    dumpHash,
    cardSignature,
    snapshotHash,
    generatedAt: new Date().toISOString(),
  };
};

// ---------- ASCII INSPECTOR ----------

export type AsciiHit = {
  block: number;
  sector: number;
  text: string;
};

export const extractReadableStrings = (blocks: ParsedBlock[], min = 4): AsciiHit[] => {
  const hits: AsciiHit[] = [];
  blocks.forEach((b) => {
    const matches = b.ascii.match(/[\x20-\x7e]{4,}/g);
    if (!matches) return;
    matches
      .filter((m) => m.length >= min && /[A-Za-z0-9]/.test(m))
      .forEach((text) => hits.push({ block: b.block, sector: b.sector, text }));
  });
  return hits;
};

// ---------- POSSIBLE TIMESTAMP / COUNTER ----------

export type ValueCandidate = {
  block: number;
  sector: number;
  kind: "timestamp" | "counter" | "value-block" | "balance";
  value: number;
  note: string;
};

// MIFARE Classic value-block format:
//  bytes  0..3 : value (LE int32)
//  bytes  4..7 : ~value
//  bytes  8..11: value
//  bytes 12    : addr
//  bytes 13    : ~addr
//  bytes 14    : addr
//  bytes 15    : ~addr
const isMifareValueBlock = (b: number[]): boolean => {
  if (b.length < 16) return false;
  for (let i = 0; i < 4; i++) {
    if (b[i] !== b[i + 8]) return false;
    if (((b[i] ^ 0xff) & 0xff) !== b[i + 4]) return false;
  }
  const addr = b[12];
  if (b[14] !== addr) return false;
  if (((addr ^ 0xff) & 0xff) !== b[13]) return false;
  if (((addr ^ 0xff) & 0xff) !== b[15]) return false;
  return true;
};

export const detectValueCandidates = (blocks: ParsedBlock[]): ValueCandidate[] => {
  const out: ValueCandidate[] = [];
  blocks.forEach((b) => {
    if (b.isTrailer || b.bytes.length < 4) return;

    // 1) Real MIFARE Value Block (saldo / contador estruturado)
    if (isMifareValueBlock(b.bytes)) {
      const raw =
        (b.bytes[0] | (b.bytes[1] << 8) | (b.bytes[2] << 16) | (b.bytes[3] << 24)) | 0; // signed int32
      out.push({
        block: b.block,
        sector: b.sector,
        kind: "value-block",
        value: raw,
        note: `MIFARE value block (addr=0x${b.bytes[12].toString(16).padStart(2, "0")}) — possível saldo/contador`,
      });
    }

    // 2) Timestamp heuristic (uint32 BE/LE em janela plausível)
    const beHead = (b.bytes[0] << 24) | (b.bytes[1] << 16) | (b.bytes[2] << 8) | b.bytes[3];
    const leHead = b.bytes[0] | (b.bytes[1] << 8) | (b.bytes[2] << 16) | (b.bytes[3] << 24);
    const now = Date.now() / 1000;
    [beHead >>> 0, leHead >>> 0].forEach((v, i) => {
      if (v > 946684800 && v < now + 86400) {
        out.push({
          block: b.block,
          sector: b.sector,
          kind: "timestamp",
          value: v,
          note: `${i === 0 ? "BE" : "LE"} uint32 ≈ ${new Date(v * 1000).toISOString()}`,
        });
      }
    });

    // 3) Contador LE uint16 (saldo bruto, créditos, tickets)
    if (
      (b.bytes[0] !== 0 || b.bytes[1] !== 0) &&
      b.bytes.slice(2).every((x) => x === 0 || x === 0xff)
    ) {
      const v = b.bytes[0] | (b.bytes[1] << 8);
      out.push({
        block: b.block,
        sector: b.sector,
        kind: "counter",
        value: v,
        note: `Possível contador LE uint16 (raw=${v})`,
      });
    }
  });
  return out;
};

// ---------- ENTROPY CLASSIFICATION ----------

export type EntropyClass = "EMPTY" | "STRUCTURED" | "MIXED" | "ENCRYPTED";

export const classifyEntropy = (entropy: number, isEmpty: boolean): EntropyClass => {
  if (isEmpty || entropy < 0.5) return "EMPTY";
  if (entropy < 3.5) return "STRUCTURED";
  if (entropy < 6.5) return "MIXED";
  return "ENCRYPTED";
};

// ---------- DIFF ----------

export type DiffEntry = {
  block: number;
  sector: number;
  before: string;
  after: string;
  changed: boolean;
  isTrailer: boolean;
};

const buildBlockMap = (snap: Snapshot) => {
  const m = new Map<number, { hex: string; sector: number; isTrailer: boolean }>();
  normalizeAuthResults(snap.data).forEach((r) =>
    (r.blocks ?? []).forEach((b) =>
      m.set(b.block, {
        hex: b.hex,
        sector: r.sector,
        isTrailer: isTrailerBlock(b.block, r.sector, b.isTrailer),
      }),
    ),
  );
  return m;
};

export const diffSnapshots = (a: Snapshot, b: Snapshot): DiffEntry[] => {
  const mapA = buildBlockMap(a);
  const mapB = buildBlockMap(b);
  const blocks = new Set<number>([...mapA.keys(), ...mapB.keys()]);
  return Array.from(blocks)
    .map((blk) => {
      const ea = mapA.get(blk);
      const eb = mapB.get(blk);
      const before = ea?.hex ?? "—";
      const after = eb?.hex ?? "—";
      return {
        block: blk,
        sector: eb?.sector ?? ea?.sector ?? -1,
        before,
        after,
        changed: before !== after,
        isTrailer: ea?.isTrailer ?? eb?.isTrailer ?? false,
      };
    })
    .sort((x, y) => x.block - y.block);
};

// ---------- FULL REPORT ----------

export type ForensicReport = {
  generatedAt: string;
  platform: "capacitor" | "web";
  cardInfo: {
    uid: string;
    type: string;
    tech: string[];
    mifareSize?: number;
    sectorCount?: number;
    blockCount?: number;
    timestamp?: number;
  };
  parsedBlocks: ParsedBlock[];
  trailers: TrailerAnalysis[];
  security: SecurityAnalysis;
  fingerprint: Fingerprint;
  asciiHits: AsciiHit[];
  valueCandidates: ValueCandidate[];
  entropy: {
    overall: number;
    overallClass: EntropyClass;
    perBlock: { block: number; sector: number; entropy: number; class: EntropyClass }[];
  };
  variability: VariableBlockRow[];
  snapshotsCount: number;
  diff: DiffEntry[] | null;
  authResults: AuthResult[];
  readOnly: true;
};

export const buildForensicReport = async (
  payload: NfcPayload | null | undefined,
  snapshots: Snapshot[],
  diff: DiffEntry[] | null,
): Promise<ForensicReport> => {
  const authResults = normalizeAuthResults(payload);
  const blocks = parseDump(payload);
  const trailers = blocks.map(analyzeTrailer).filter(Boolean) as TrailerAnalysis[];
  const security = analyzeSecurity(payload, blocks);
  const fingerprint = await generateFingerprint(payload, blocks);
  const asciiHits = extractReadableStrings(blocks);
  const valueCandidates = detectValueCandidates(blocks);
  const allBytes = blocks.flatMap((b) => b.bytes);
  const overallEntropy = shannonEntropy(allBytes);
  const entropy = {
    overall: overallEntropy,
    overallClass: classifyEntropy(overallEntropy, allBytes.length === 0 || allBytes.every((x) => x === 0)),
    perBlock: blocks.map((b) => {
      const e = shannonEntropy(b.bytes);
      return { block: b.block, sector: b.sector, entropy: e, class: classifyEntropy(e, b.isEmpty) };
    }),
  };
  const variability = analyzeVariability(snapshots);

  return {
    generatedAt: new Date().toISOString(),
    platform: (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
      ? "capacitor"
      : "web",
    cardInfo: {
      uid: payload?.uid ?? "-",
      type: detectCardType(payload),
      tech: payload?.tech ?? [],
      mifareSize: payload?.mifareSize,
      sectorCount: payload?.sectorCount,
      blockCount: payload?.blockCount,
      timestamp: payload?.timestamp,
    },
    parsedBlocks: blocks,
    trailers,
    security,
    fingerprint,
    asciiHits,
    valueCandidates,
    entropy,
    variability,
    snapshotsCount: snapshots.length,
    diff,
    authResults,
    readOnly: true,
  };
};

export const reportToText = (r: ForensicReport): string => {
  const lines: string[] = [];
  const push = (s = "") => lines.push(s);
  push("============================================================");
  push("           FORENSIC REPORT — NFC MIFARE ANALYZER");
  push("============================================================");
  push(`Generated: ${r.generatedAt}`);
  push(`Platform : ${r.platform}`);
  push(`Read-only: ${r.readOnly}`);
  push("");
  push("--- CARD INFO ---");
  push(`UID         : ${r.cardInfo.uid}`);
  push(`Type        : ${r.cardInfo.type}`);
  push(`Tech        : ${r.cardInfo.tech.join(", ") || "-"}`);
  push(`Size        : ${r.cardInfo.mifareSize ?? "-"}`);
  push(`Sectors     : ${r.cardInfo.sectorCount ?? "-"}`);
  push(`Blocks      : ${r.cardInfo.blockCount ?? "-"}`);
  push(`Timestamp   : ${r.cardInfo.timestamp ?? "-"}`);
  push("");
  push("--- FINGERPRINT ---");
  push(`Dump SHA-256       : ${r.fingerprint.dumpHash}`);
  push(`Card signature     : ${r.fingerprint.cardSignature}`);
  push(`Snapshot SHA-256   : ${r.fingerprint.snapshotHash}`);
  push("");
  push("--- SECURITY ---");
  push(`Score    : ${r.security.score}/100`);
  push(`Risk     : ${r.security.risk}`);
  push(`Open sectors           : ${r.security.openSectors.join(", ") || "-"}`);
  push(`Default-key sectors    : ${r.security.defaultKeySectors.join(", ") || "-"}`);
  push(`Permissive ACL sectors : ${r.security.writableSectorsSuspect.join(", ") || "-"}`);
  push(`Weak keys count        : ${r.security.weakKeys}`);
  r.security.findings.forEach((f) => push(` - ${f}`));
  push("");
  push("--- ENTROPY ---");
  push(`Overall: ${r.entropy.overall.toFixed(3)} bits/byte`);
  push("");
  push("--- ASCII HITS ---");
  if (r.asciiHits.length === 0) push("(none)");
  r.asciiHits.forEach((h) => push(`  S${h.sector} B${h.block}: "${h.text}"`));
  push("");
  push("--- VALUE CANDIDATES ---");
  if (r.valueCandidates.length === 0) push("(none)");
  r.valueCandidates.forEach((c) =>
    push(`  S${c.sector} B${c.block} [${c.kind}] ${c.value} (${c.note})`),
  );
  push("");
  push("--- VARIABLE BLOCKS ---");
  if (r.variability.length === 0) push("(insufficient snapshots)");
  r.variability.slice(0, 20).forEach((v) =>
    push(`  S${v.sector} B${v.block} ${v.level} — ${v.changes}/${v.total} changes (${v.percent}%)`),
  );
  push("");
  push("--- BLOCK DUMP ---");
  r.parsedBlocks.forEach((b) =>
    push(`  S${b.sector} B${b.block} ${b.isTrailer ? "[TRAILER]" : "[DATA]   "} ${b.hex}  | ${b.ascii}`),
  );
  push("");
  if (r.diff && r.diff.length > 0) {
    push("--- SNAPSHOT DIFF ---");
    r.diff.filter((d) => d.changed).forEach((d) => {
      push(`  S${d.sector} B${d.block}${d.isTrailer ? " [TRAILER]" : ""}`);
      push(`    ANTES : ${d.before}`);
      push(`    DEPOIS: ${d.after}`);
    });
  }
  push("");
  push("============================================================");
  push("END OF REPORT — READ ONLY · NO WRITE · NO EMULATION");
  push("============================================================");
  return lines.join("\n");
};
