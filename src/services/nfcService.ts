// NFC service — wraps the future native Capacitor plugin with a web fallback
// so the UI can be developed before the Android module is installed.

export interface NfcData {
  uid: string;
  technologies: string[];
  cardType: string;
  atqa?: string;
  sak?: string;
  historicalBytes?: string;
  maxTransceiveLength?: number;
  timestamp: number;
  simulated?: boolean;
}

type NfcCallback = (data: NfcData) => void;

const randHex = (n: number) =>
  Array.from({ length: n }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase(),
  ).join(":");

const simulate = (): NfcData => ({
  uid: randHex(7),
  technologies: ["NfcA", "MifareClassic", "IsoDep"],
  cardType: "MIFARE Classic 1K (simulado)",
  atqa: "00:04",
  sak: "08",
  historicalBytes: randHex(8),
  maxTransceiveLength: 253,
  timestamp: Date.now(),
  simulated: true,
});

/**
 * Inicia uma leitura NFC. Se o plugin Capacitor nativo estiver disponível
 * (window.Capacitor.Plugins.NfcReader), delega para ele. Caso contrário,
 * usa uma simulação para desenvolvimento da UI.
 */
export async function startNFCScan(onRead: NfcCallback): Promise<void> {
  const w = window as unknown as {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: { NfcReader?: { read: () => Promise<NfcData> } };
    };
  };

  const plugin = w.Capacitor?.Plugins?.NfcReader;
  try {
    if (plugin && typeof plugin.read === "function") {
      const data = await plugin.read();
      onRead(data);
      return;
    }
  } catch (err) {
    console.warn("[nfcService] Plugin nativo falhou, usando simulação:", err);
  }

  // Fallback simulado
  await new Promise((r) => setTimeout(r, 1800));
  onRead(simulate());
}
