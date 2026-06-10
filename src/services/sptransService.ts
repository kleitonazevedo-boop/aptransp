// Wrapper para a edge function sptrans-proxy.
// Toda comunicação com a API Olho Vivo passa por aqui.
//
// Cache em memória com TTL diferenciado por tipo de chamada.
// Token-bucket simples para evitar burst (10 req/s).

import { SUPABASE_PROJECT_URL } from "@/integrations/supabase/client";

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const FUNCTION_URL = `${SUPABASE_PROJECT_URL.replace(".supabase.co", ".functions.supabase.co")}/sptrans-proxy`;

interface CacheEntry { ts: number; ttl: number; data: unknown }
const cache = new Map<string, CacheEntry>();

let tokens = 10;
const refillIntervalMs = 100;
setInterval(() => { if (tokens < 10) tokens++; }, refillIntervalMs);

async function take(): Promise<void> {
  while (tokens <= 0) await new Promise((r) => setTimeout(r, 50));
  tokens--;
}

async function call<T>(path: string, params: Record<string, string | number> = {}, ttlMs = 60_000): Promise<T> {
  const search = new URLSearchParams({ path });
  for (const [k, v] of Object.entries(params)) search.set(k, String(v));
  const key = search.toString();

  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < hit.ttl) return hit.data as T;

  await take();
  const res = await fetch(`${FUNCTION_URL}?${key}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`sptrans ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as T;
  cache.set(key, { ts: Date.now(), ttl: ttlMs, data });
  return data;
}

export interface SPTransLine {
  cl: number; lc: boolean; lt: string; sl: number; tl: number; tp: string; ts: string;
}
export interface SPTransStop { cp: number; np: string; ed: string; py: number; px: number }
export interface SPTransArrivalLine {
  c: string; cl: number; sl: number; lt0: string; lt1: string;
  vs: Array<{ p: string; t: string; px: number; py: number }>;
}
export interface SPTransArrival { hr: string; p: { cp: number; np: string; py: number; px: number; l: SPTransArrivalLine[] } }

export const sptransService = {
  /** Busca linhas pelo termo. TTL 5min. */
  searchLines: (termo: string) => call<SPTransLine[]>("/Linha/Buscar", { termosBusca: termo }, 5 * 60_000),

  /** Posição em tempo real dos veículos de uma linha. TTL 30s. */
  positionsByLine: (codigoLinha: number) =>
    call<{ hr: string; vs: Array<{ p: number; a: boolean; ta: string; py: number; px: number }> }>(
      "/Posicao/Linha", { codigoLinha }, 30_000),

  /** Previsão de chegada para uma parada. TTL 30s. */
  arrivalsByStop: (codigoParada: number) =>
    call<SPTransArrival>("/Previsao/Parada", { codigoParada }, 30_000),

  /** Previsão de chegada para uma linha. TTL 30s. */
  arrivalsByLine: (codigoLinha: number) =>
    call<SPTransArrival>("/Previsao/Linha", { codigoLinha }, 30_000),

  /** Busca paradas pelo termo (nome/endereço). TTL 10min. */
  searchStops: (termo: string) => call<SPTransStop[]>("/Parada/Buscar", { termosBusca: termo }, 10 * 60_000),

  /** Lista corredores. TTL 1h. */
  corridors: () => call<Array<{ cc: number; nc: string }>>("/Corredor", {}, 60 * 60_000),

  /** Lista terminais. TTL 1h. */
  terminals: () => call<Array<{ cd: number; nt: string; py: number; px: number }>>(
    "/Terminal", {}, 60 * 60_000),

  /** True se a edge function respondeu pelo menos uma vez sem erro. */
  isAvailable(): boolean {
    return Array.from(cache.values()).some((e) => Array.isArray(e.data) || typeof e.data === "object");
  },
};
