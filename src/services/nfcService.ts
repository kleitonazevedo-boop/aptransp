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
        cb: (data: unknown) => void,
      ) =>
        | { remove: () => void }
        | { remove: () => Promise<void> }
        | Promise<{ remove: () => void }>;
    };
  };
}

/**
 * Faz parse seguro do payload vindo do Android.
 */
function parseNfcPayload(raw: unknown): NfcData | null {
  try {
    let data: unknown = raw;

    // Android envia STRING JSON
    if (typeof data === "string") {
      data = JSON.parse(data);
    }

    if (!data || typeof data !== "object") {
      return null;
    }

    const obj = data as Record<string, unknown>;

    // Alguns bridges podem aninhar em detail
    if (typeof obj.detail === "string") {
      return parseNfcPayload(obj.detail);
    }

    const uid =
      typeof obj.uid === "string"
        ? obj.uid
        : null;

    const tech = Array.isArray(obj.tech)
      ? obj.tech.map(String)
      : [];

    if (!uid) {
      return null;
    }

    return {
      uid,
      tech,
      timestamp:
        typeof obj.timestamp === "number"
          ? obj.timestamp
          : Date.now(),
    };

  } catch (err) {
    console.error("Falha ao parsear payload NFC:", err, raw);
    return null;
  }
}

/**
 * Escuta eventos NFC vindos do Android.
 */
export function onNfcResult(
  callback: NfcCallback
): UnsubscribeFn {

  // =========================
  // WEB / CUSTOM EVENT
  // =========================

  const handler = (e: Event) => {

    console.log("NFC EVENT RECEBIDO:", e);

    const parsed = parseNfcPayload(
      (e as CustomEvent).detail
    );

    if (parsed) {

      console.log("NFC PARSED:", parsed);

      callback(parsed);

    } else {

      console.error("Falha parse NFC");

    }
  };

  window.addEventListener(
    "nfcResult",
    handler
  );

  return () => {
    window.removeEventListener(
      "nfcResult",
      handler
    );
  };
}