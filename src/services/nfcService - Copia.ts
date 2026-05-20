// NFC service — listens for native Android NFC events via Capacitor bridge.
// The frontend NEVER accesses NFC directly.

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
<<<<<<< Updated upstream
<<<<<<< Updated upstream
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
=======
        cb: (data: NfcData) => void,
      ) =>
        | { remove: () => void }
        | { remove: () => Promise<void> }
        | Promise<{ remove: () => void }>;
    };
  };
}

/**
 * Subscribe to NFC results coming from Android native layer.
 * Works both on real device (Capacitor) and web fallback (for testing).
>>>>>>> Stashed changes
=======
        cb: (data: NfcData) => void,
      ) =>
        | { remove: () => void }
        | { remove: () => Promise<void> }
        | Promise<{ remove: () => void }>;
    };
  };
}

/**
 * Subscribe to NFC results coming from Android native layer.
 * Works both on real device (Capacitor) and web fallback (for testing).
>>>>>>> Stashed changes
 */
export function onNfcResult(callback: NfcCallback): UnsubscribeFn {
  const w = window as unknown as { Capacitor?: CapacitorLike };
  const cap = w.Capacitor;

<<<<<<< Updated upstream
<<<<<<< Updated upstream
  // 1) Bridge nativo (Capacitor Plugins.App.addListener)
=======
  // =========================
  // 1. NATIVE (CAPACITOR)
  // =========================
>>>>>>> Stashed changes
  const appPlugin = cap?.Plugins?.App;

  if (cap?.isNativePlatform?.() && appPlugin?.addListener) {
<<<<<<< Updated upstream
    const handlePromise = appPlugin.addListener("nfcResult", (data) => {
      const parsed = parseNfcPayload(data);
      if (parsed) callback(parsed);
=======
=======
  // =========================
  // 1. NATIVE (CAPACITOR)
  // =========================
  const appPlugin = cap?.Plugins?.App;

  if (cap?.isNativePlatform?.() && appPlugin?.addListener) {
>>>>>>> Stashed changes
    const handle = appPlugin.addListener("nfcResult", (data: NfcData) => {
      callback({
        ...data,
        timestamp: data.timestamp ?? Date.now(),
      });
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
    });

    return () => {
      Promise.resolve(handle)
        .then((h) => h?.remove?.())
        .catch(() => {});
    };
  }

<<<<<<< Updated upstream
<<<<<<< Updated upstream
  // 2) Fallback / triggerJSEvent — window CustomEvent("nfcResult", { detail: "<json>" })
  const handler = (e: Event) => {
    const parsed = parseNfcPayload((e as CustomEvent).detail);
    if (parsed) callback(parsed);
=======
=======
>>>>>>> Stashed changes
  // =========================
  // 2. WEB FALLBACK (DEV)
  // =========================
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<NfcData>).detail;

    if (detail?.uid) {
      callback({
        ...detail,
        timestamp: detail.timestamp ?? Date.now(),
      });
    }
>>>>>>> Stashed changes
  };

  window.addEventListener("nfcResult", handler);

  return () => {
    window.removeEventListener("nfcResult", handler);
  };
}