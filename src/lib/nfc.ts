export type ReadingStatus = "Cartão detectado" | "Leitura parcial" | "Protegido";

export interface NfcReading {
  id: string;
  timestamp: number;
  status: ReadingStatus;
  uid: string;
  technologies: string[];
  compatibility: string;
  balance: string;
}

const randHex = () =>
  Array.from({ length: 7 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase()
  ).join(":");

const scenarios: Array<Omit<NfcReading, "id" | "timestamp" | "uid">> = [
  {
    status: "Cartão detectado",
    technologies: ["NfcA", "IsoDep", "MIFARE Classic (simulado)"],
    compatibility: "Compatível com leitura NFC básica",
    balance: "Indisponível nesta versão",
  },
  {
    status: "Leitura parcial",
    technologies: ["NfcA", "Ndef"],
    compatibility: "Compatibilidade parcial",
    balance: "Indisponível nesta versão",
  },
  {
    status: "Protegido",
    technologies: ["NfcA", "IsoDep"],
    compatibility: "Áreas protegidas detectadas",
    balance: "Indisponível nesta versão",
  },
];

export const generateReading = (): NfcReading => {
  const s = scenarios[Math.floor(Math.random() * scenarios.length)];
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    uid: randHex(),
    ...s,
  };
};

const KEY = "nfc_readings_history_v1";

export const getHistory = (): NfcReading[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};

export const saveReading = (r: NfcReading) => {
  const list = [r, ...getHistory()].slice(0, 50);
  localStorage.setItem(KEY, JSON.stringify(list));
};

export const clearHistory = () => localStorage.removeItem(KEY);

export const formatDate = (ts: number) =>
  new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
