import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
  CapacitorHttp: { get: vi.fn() },
}));
vi.mock("@/services/googleMapsService", () => ({ hasGoogleKey: vi.fn(), loadGoogleMaps: vi.fn() }));
vi.mock("@/services/connectivityService", () => ({ connectivityService: { isOnline: vi.fn() } }));
vi.mock("@/database/database", () => ({ getDb: vi.fn() }));
vi.mock("@/repositories/gtfsRepository", () => ({ gtfsRepository: { counts: vi.fn() } }));

import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { checkHomelab } from "@/services/diagnosticsService";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("Conexão homelab", () => {
  it("reports missing configuration", async () => {
    vi.stubEnv("VITE_APTRANSP_API_URL", "");
    expect((await checkHomelab()).status).toBe("fail");
  });

  it("rejects invalid URLs", async () => {
    vi.stubEnv("VITE_APTRANSP_API_URL", "file:///test");
    expect((await checkHomelab()).detail).toBe("Endereço homelab inválido");
  });

  it("checks the configured address and accepts an HTTP response", async () => {
    vi.stubEnv("VITE_APTRANSP_API_URL", "http://homelab.test:3000");
    const fetchMock = vi.fn().mockResolvedValue({ status: 404 });
    vi.stubGlobal("fetch", fetchMock);
    expect(await checkHomelab()).toMatchObject({ key: "homelab", status: "ok", detail: "Servidor acessível · HTTP 404" });
    expect(fetchMock).toHaveBeenCalledWith("http://homelab.test:3000/", expect.objectContaining({ method: "GET" }));
  });

  it("reports connection failures", async () => {
    vi.stubEnv("VITE_APTRANSP_API_URL", "http://homelab.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect((await checkHomelab()).status).toBe("fail");
  });

  it("stops a browser request after eight seconds", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_APTRANSP_API_URL", "http://homelab.test");
    vi.stubGlobal("fetch", vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
    })));
    const pending = checkHomelab();
    await vi.advanceTimersByTimeAsync(8000);
    expect((await pending).detail).toBe("Sem resposta em 8 segundos");
  });

  it("uses native HTTP on Android", async () => {
    vi.stubEnv("VITE_APTRANSP_API_URL", "http://homelab.test");
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(CapacitorHttp.get).mockResolvedValue({ status: 200, data: {}, headers: {}, url: "http://homelab.test/" });
    expect((await checkHomelab()).status).toBe("ok");
    expect(CapacitorHttp.get).toHaveBeenCalledWith({ url: "http://homelab.test/", connectTimeout: 8000, readTimeout: 8000 });
  });
});