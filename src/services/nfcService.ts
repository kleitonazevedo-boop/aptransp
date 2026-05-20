// NFC service — listens for native Capacitor events emitted by the Android
// native NFC plugin. The frontend does NOT access NFC directly via JS;
// it only subscribes to the "nfcResult" event coming from the bridge.

export interface NfcData {
  uid: string;
  tech: string[];
  timestamp?: number;
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
    const parsed = parseNfcPayload((e as CustomEvent).detail);
    if (parsed) callback(parsed);
  };
  window.addEventListener("nfcResult", handler);
  return () => window.removeEventListener("nfcResult", handler);
}
