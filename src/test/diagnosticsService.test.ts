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

describe("API APTRANSP centralizada", () => {
  it("reports missing base URL", async () => {
    vi.stubEnv("VITE_APTRANSP_API_URL", "");
    expect(await checkHomelab()).toMatchObject({ status: "fail" });
  });

  it("rejects invalid URL schemes", async () => {
    vi.stubEnv("VITE_APTRANSP_API_URL", "file:///invalid");
    expect((await checkHomelab()).detail).toContain("válida");
  });

  it("checks health through the configured base URL", async () => {
    vi.stubEnv("VITE_APTRANSP_API_URL", "http://192.168.15.124:3000");
    const fetchMock = vi.fn().mockResolvedValue({ status: 404 });
    vi.stubGlobal("fetch", fetchMock);
    expect(await checkHomelab()).toMatchObject({ status: "ok", detail: "Servidor acessível · HTTP 404" });
    expect(fetchMock).toHaveBeenCalledWith("http://192.168.15.124:3000/health", expect.anything());
  });

  it("uses the same base URL for GTFS health and latest metadata", async () => {
    vi.stubEnv("VITE_APTRANSP_API_URL", "https://api.test");
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, text: async () => '{"status":"ok"}' });
    vi.stubGlobal("fetch", fetchMock);
    expect((await checkGtfsHealth()).status).toBe("ok");
    expect((await checkGtfsPackage()).status).toBe("ok");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.test/health/database",
      "https://api.test/api/v1/gtfs/sync/latest",
    ]);
  });

  it("reports network errors without breaking offline diagnostics", async () => {
    vi.stubEnv("VITE_APTRANSP_API_URL", "http://192.168.15.124:3000");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect((await checkHomelab()).status).toBe("fail");
  });

  it("keeps the native Capacitor HTTP path", async () => {
    vi.stubEnv("VITE_APTRANSP_API_URL", "http://192.168.15.124:3000");
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(CapacitorHttp.get).mockResolvedValue({ status: 200, data: {}, headers: {}, url: "http://192.168.15.124:3000/health" });
    expect((await checkHomelab()).status).toBe("ok");
    expect(CapacitorHttp.get).toHaveBeenCalledWith({
      url: "http://192.168.15.124:3000/health", connectTimeout: 8000, readTimeout: 8000,
    });
  });
});
