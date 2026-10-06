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
import { checkHomelab, checkGtfsHealth, checkGtfsPackage } from "@/services/diagnosticsService";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe.each([
  ["API GTFS Health", "VITE_APTRANSP_API_HEALTH", checkGtfsHealth],
  ["API GTFS Package", "VITE_APTRANSP_API_PACK", checkGtfsPackage],
] as const)("%s", (label, envName, check) => {
  it("reports missing configuration", async () => {
    vi.stubEnv(envName, "");
    expect(await check()).toMatchObject({ label, status: "fail", detail: `${envName} não configurada` });
  });

  it("preserves the complete JSON response", async () => {
    vi.stubEnv(envName, "http://gtfs.test/endpoint");
    const data = { status: "ready", message: "long response ".repeat(100), files: ["stops.txt", "routes.txt"] };
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, text: async () => JSON.stringify(data) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await check()).toMatchObject({ label, status: "ok", detail: `HTTP 200\n${JSON.stringify(data, null, 2)}` });
    expect(fetchMock).toHaveBeenCalledWith("http://gtfs.test/endpoint", expect.anything());
  });

  it("shows unsuccessful HTTP responses without hiding the body", async () => {
    vi.stubEnv(envName, "http://gtfs.test/endpoint");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 503, text: async () => "Service unavailable\nRetry later" }));
    expect(await check()).toMatchObject({ status: "fail", detail: "HTTP 503\nService unavailable\nRetry later" });
  });

  it("reads native HTTP response bodies", async () => {
    vi.stubEnv(envName, "http://gtfs.test/endpoint");
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(CapacitorHttp.get).mockResolvedValue({ status: 200, data: { ready: true }, headers: {}, url: "http://gtfs.test/endpoint" });
    expect(await check()).toMatchObject({ status: "ok", detail: 'HTTP 200\n{\n  "ready": true\n}' });
    expect(CapacitorHttp.get).toHaveBeenCalledWith(expect.objectContaining({ responseType: "text" }));
  });
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