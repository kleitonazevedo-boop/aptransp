// NFC service — listens for native Capacitor events emitted by the Android
// native NFC plugin. The frontend does NOT access NFC directly via JS;
// it only subscribes to the "nfcResult" event coming from the bridge.

export interface NfcData {
  uid: string;
  tech: string[];
  timestamp?: number;
  mifareType?: number;
  mifareSize?: number;
  sectorCount?: number;
  blockCount?: number;
  authResults?: unknown[];
  rawBlocks?: unknown[];
  blocks?: unknown[];
  readOnly?: boolean;
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
 * O Android envia via triggerJSEvent como STRING JSON, ex:
 *   "{\"uid\":\"04:A1:B2:C3\",\"tech\":[\"NfcA\",\"MifareClassic\"]}"
 * Também aceita objeto já parseado (fallback web).
 */
function parseNfcPayload(raw: unknown): NfcData | null {
  try {
    let data: unknown = raw;

    // event.detail pode chegar como string JSON do bridge
    if (typeof data === "string") {
      data = JSON.parse(data);
    }

    if (!data || typeof data !== "object") return null;
    const obj = data as Record<string, unknown>;

    // Alguns bridges entregam { detail: "..." } aninhado
    if (typeof obj.detail === "string") {
      return parseNfcPayload(obj.detail);
    }

    const uid = typeof obj.uid === "string" ? obj.uid : null;
    const tech = Array.isArray(obj.tech) ? (obj.tech as unknown[]).map(String) : [];
    if (!uid) return null;

    return {
      uid,
      tech,
      timestamp: typeof obj.timestamp === "number" ? obj.timestamp : Date.now(),
      mifareType: typeof obj.mifareType === "number" ? obj.mifareType : undefined,
      mifareSize: typeof obj.mifareSize === "number" ? obj.mifareSize : undefined,
      sectorCount: typeof obj.sectorCount === "number" ? obj.sectorCount : undefined,
      blockCount: typeof obj.blockCount === "number" ? obj.blockCount : undefined,
      authResults: Array.isArray(obj.authResults) ? obj.authResults : undefined,
      rawBlocks: Array.isArray(obj.rawBlocks) ? obj.rawBlocks : undefined,
      blocks: Array.isArray(obj.blocks) ? obj.blocks : undefined,
      readOnly: obj.readOnly === true,
    };
  } catch (err) {
    console.error("Falha ao parsear payload NFC:", err, raw);
    return null;
  }
}

/**
 * Assina o evento global "nfcResult" emitido pelo módulo nativo Android via
 * Capacitor. Retorna uma função para cancelar a assinatura.
 *
 * O Android envia os dados como STRING JSON (triggerJSEvent), então sempre
 * passamos por JSON.parse via parseNfcPayload.
 */
export function onNfcResult(callback: NfcCallback): UnsubscribeFn {
  const w = window as unknown as { Capacitor?: CapacitorLike };
  const cap = w.Capacitor;

  // 1) Bridge nativo (Capacitor Plugins.App.addListener)
  const appPlugin = cap?.Plugins?.App;
  if (cap?.isNativePlatform?.() && appPlugin?.addListener) {
    const handlePromise = appPlugin.addListener("nfcResult", (data) => {
      const parsed = parseNfcPayload(data);
      if (parsed) callback(parsed);
    });
    return () => {
      Promise.resolve(handlePromise).then((h) => h?.remove?.()).catch(() => {});
    };
  }

  // 2) Fallback / triggerJSEvent — window CustomEvent("nfcResult", { detail: "<json>" })
  const handler = (e: Event) => {
    const custom = e as CustomEvent;
    const raw = custom.detail ?? Object.fromEntries(
      ["uid", "tech", "timestamp", "mifareType", "mifareSize", "sectorCount", "blockCount", "authResults", "blocks", "rawBlocks", "readOnly", "error"]
        .map((key) => [key, (e as unknown as Record<string, unknown>)[key]])
        .filter(([, value]) => value !== undefined),
    );
    const parsed = parseNfcPayload(raw);
    if (parsed) callback(parsed);
  };
  window.addEventListener("nfcResult", handler);
  return () => window.removeEventListener("nfcResult", handler);
}
