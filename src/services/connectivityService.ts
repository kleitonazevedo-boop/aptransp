/**
 * Detecção de conectividade (ONLINE/OFFLINE).
 * Usa @capacitor/network no Android/iOS e navigator.onLine na web.
 * Recursos online (Google Directions/Places) devem consultar isOnline() antes de chamar.
 */
import { Capacitor } from "@capacitor/core";

export type ConnectivityStatus = "online" | "offline";

let current: ConnectivityStatus = typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "online";
const listeners = new Set<(s: ConnectivityStatus) => void>();

function emit(next: ConnectivityStatus) {
  if (next === current) return;
  current = next;
  listeners.forEach((fn) => fn(next));
  console.log(`[connectivity] ${next.toUpperCase()}`);
}

async function start() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Network } = await import("@capacitor/network");
      const status = await Network.getStatus();
      emit(status.connected ? "online" : "offline");
      await Network.addListener("networkStatusChange", (s) => emit(s.connected ? "online" : "offline"));
      return;
    } catch (e) {
      console.warn("[connectivity] plugin indisponível, usando navigator", e);
    }
  }
  window.addEventListener("online", () => emit("online"));
  window.addEventListener("offline", () => emit("offline"));
}

if (typeof window !== "undefined") void start();

export const connectivityService = {
  get status(): ConnectivityStatus {
    return current;
  },
  isOnline(): boolean {
    return current === "online";
  },
  subscribe(fn: (s: ConnectivityStatus) => void): () => void {
    listeners.add(fn);
    fn(current);
    return () => listeners.delete(fn);
  },
};
