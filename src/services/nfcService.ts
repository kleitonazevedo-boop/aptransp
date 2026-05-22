// NFC service — listens for native Capacitor events emitted by the Android
// native NFC plugin. The frontend does NOT access NFC directly via JS;
// it only subscribes to the "nfcResult" event coming from the bridge.

export interface AuthResult {
  sector: number;
  authenticated: boolean;
  keyUsed?: string | null;
  keyType?: string | null;
  error?: string | null;
  usedDefaultKey?: boolean;
  blocks?: unknown[];
}

export interface ForensicMetadata {
  generatedAt?: string;
  source?: string;
  exportFormat?: string;
  platform?: string;
}

export interface MifareInfo {
  mifareType?: number;
  mifareTypeLabel?: string;
  mifareSize?: number;
  mifareSizeLabel?: string;
  sectorCount?: number;
  blockCount?: number;
  tech?: string[];
}

export interface SnapshotData {
  uid: string;
  tech: string[];
  timestamp?: number;
  mifareType?: number;
  mifareSize?: number;
  sectorCount?: number;
  blockCount?: number;
  authResults?: AuthResult[];
  rawBlocks?: unknown[];
  blocks?: unknown[];
  readOnly?: boolean;
}

export interface NfcData {
  uid: string;
  tech: string[];
  timestamp?: number;

  // forensic
  authState?: {
    totalSectors?: number;
    authenticatedSectors?: number;
    deniedSectors?: number[];
    accessPercent?: number;
  };

  validSectors?: number[];

  blocksRead?: number;
  rawBlocks?: unknown[];
  blocks?: unknown[];

  diffData?: {
    snapshotA?: unknown;
    snapshotB?: unknown;
    changedBlocks?: unknown[];
    unchangedBlocks?: unknown[];
  };

  forensicMetadata?: ForensicMetadata;

  mifareInfo?: MifareInfo;

  readOnly?: boolean;

  authResults?: AuthResult[];

  rawEvent?: unknown;

  snapshotData?: SnapshotData;
}

export type NfcStatus = "idle" | "scanning" | "detected" | "error";

type NfcCallback = (data: NfcData) => void;
type UnsubscribeFn = () => void;

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  Plugins?: {
    App?: {
      addListener: (
        eventName: string,
        cb: (data: unknown) => void,
      ) => Promise<{ remove: () => Promise<void> }> | { remove: () => void };
    };
  };
}

/**
 * Faz o parse defensivo do payload NFC vindo do Android.
 * Aceita:
 * - JSON string
 * - objeto puro
 * - CustomEvent.detail
 * - payload forensic completo
 */
function parseNfcPayload(raw: unknown): NfcData | null {
  try {
    let data: unknown = raw;

    // String JSON
    if (typeof data === "string") {
      data = JSON.parse(data);
    }

    if (!data || typeof data !== "object") {
      return null;
    }

    const obj = data as Record<string, unknown>;

    // Alguns bridges usam detail
    if (typeof obj.detail === "string") {
      return parseNfcPayload(obj.detail);
    }

    // Alguns bridges usam detail como objeto
    if (
      obj.detail &&
      typeof obj.detail === "object"
    ) {
      return parseNfcPayload(obj.detail);
    }

    const uid = typeof obj.uid === "string"
      ? obj.uid
      : null;

    if (!uid) {
      console.warn("Payload NFC sem UID:", obj);
      return null;
    }

    const tech = Array.isArray(obj.tech)
      ? obj.tech.map(String)
      : [];

    return {
      uid,
      tech,
      timestamp:
        typeof obj.timestamp === "number"
          ? obj.timestamp
          : Date.now(),

      authState:
        typeof obj.authState === "object"
          ? (obj.authState as NfcData["authState"])
          : undefined,

      validSectors: Array.isArray(obj.validSectors)
        ? obj.validSectors.map(Number)
        : [],

      blocksRead:
        typeof obj.blocksRead === "number"
          ? obj.blocksRead
          : 0,

      rawBlocks: Array.isArray(obj.rawBlocks)
        ? obj.rawBlocks
        : [],

      blocks: Array.isArray(obj.blocks)
        ? obj.blocks
        : [],

      diffData:
        typeof obj.diffData === "object"
          ? (obj.diffData as NfcData["diffData"])
          : undefined,

      forensicMetadata:
        typeof obj.forensicMetadata === "object"
          ? (obj.forensicMetadata as ForensicMetadata)
          : undefined,

      mifareInfo:
        typeof obj.mifareInfo === "object"
          ? (obj.mifareInfo as MifareInfo)
          : undefined,

      readOnly:
        typeof obj.readOnly === "boolean"
          ? obj.readOnly
          : false,

      authResults: Array.isArray(obj.authResults)
        ? (obj.authResults as AuthResult[])
        : [],

      rawEvent: obj.rawEvent,

      snapshotData:
        typeof obj.snapshotData === "object"
          ? (obj.snapshotData as SnapshotData)
          : undefined,
    };
  } catch (err) {
    console.error("Falha ao parsear payload NFC:", err, raw);
    return null;
  }
}

/**
 * Assina o evento global "nfcResult" emitido pelo Android.
 */
export function onNfcResult(callback: NfcCallback): UnsubscribeFn {
  const w = window as unknown as { Capacitor?: CapacitorLike };
  const cap = w.Capacitor;

  // Bridge nativo
  const appPlugin = cap?.Plugins?.App;

  if (cap?.isNativePlatform?.() && appPlugin?.addListener) {
    const handlePromise = appPlugin.addListener(
      "nfcResult",
      (data) => {
        const parsed = parseNfcPayload(data);

        if (parsed) {
          console.log("NFC forensic payload recebido:", parsed);
          callback(parsed);
        }
      },
    );

    return () => {
      Promise
        .resolve(handlePromise)
        .then((h) => h?.remove?.())
        .catch(() => {});
    };
  }

  // Fallback window event
  const handler = (e: Event) => {
    const parsed = parseNfcPayload((e as CustomEvent).detail);

    if (parsed) {
      console.log("NFC fallback payload recebido:", parsed);
      callback(parsed);
    }
  };

  window.addEventListener("nfcResult", handler);

  return () => {
    window.removeEventListener("nfcResult", handler);
  };
}
