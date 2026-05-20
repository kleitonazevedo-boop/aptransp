// NFC service — listens for native Capacitor events emitted by the Android
// native NFC plugin. The frontend does NOT access NFC directly via JS;
// it only subscribes to the "nfcResult" event coming from the bridge.

export interface NfcData {
  uid: string;
  tech: string[];
  timestamp?: number;
}

export type NfcStatus = "idle" | "scanning" | "success" | "error";

type NfcCallback = (data: NfcData) => void;
type UnsubscribeFn = () => void;

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  Plugins?: {
    App?: {
      addListener: (
        eventName: string,
        cb: (data: NfcData) => void,
      ) => Promise<{ remove: () => Promise<void> }> | { remove: () => void };
    };
  };
  addListener?: (
    eventName: string,
    cb: (data: NfcData) => void,
  ) => { remove: () => void };
}

/**
 * Assina o evento global "nfcResult" emitido pelo módulo nativo Android via
 * Capacitor. Retorna uma função para cancelar a assinatura.
 *
 * Em ambiente web (sem Capacitor), também escuta um CustomEvent("nfcResult")
 * no window para facilitar testes manuais:
 *   window.dispatchEvent(new CustomEvent("nfcResult", { detail: { uid, tech } }))
 */
export function onNfcResult(callback: NfcCallback): UnsubscribeFn {
  const w = window as unknown as { Capacitor?: CapacitorLike };
  const cap = w.Capacitor;

  // 1) Bridge nativo (Capacitor)
  const appPlugin = cap?.Plugins?.App;
  if (cap?.isNativePlatform?.() && appPlugin?.addListener) {
    const handlePromise = appPlugin.addListener("nfcResult", (data) => {
      callback({ ...data, timestamp: data.timestamp ?? Date.now() });
    });
    return () => {
      Promise.resolve(handlePromise).then((h) => h?.remove?.()).catch(() => {});
    };
  }

  // 2) Fallback web — CustomEvent
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<NfcData>).detail;
    if (detail?.uid) {
      callback({ ...detail, timestamp: detail.timestamp ?? Date.now() });
    }
  };
  window.addEventListener("nfcResult", handler);
  return () => window.removeEventListener("nfcResult", handler);
}
