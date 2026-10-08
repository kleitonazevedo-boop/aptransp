import { beforeEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { checkLocationPermission, getCurrentLocation } from "@/services/locationService";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(), getPlatform: vi.fn() },
}));
vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
}));

const browserPosition = {
  coords: { latitude: -23.55, longitude: -46.63, accuracy: 12 },
  timestamp: 1,
} as GeolocationPosition;
const nativePosition = {
  coords: {
    latitude: -23.55, longitude: -46.63, accuracy: 12,
    altitudeAccuracy: null, altitude: null, speed: null, heading: null,
    magneticHeading: null, trueHeading: null, headingAccuracy: null, course: null,
  },
  timestamp: 1,
};

describe("locationService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.localStorage?.clear();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Capacitor.getPlatform).mockReturnValue("web");
    Object.defineProperty(globalThis.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
      },
    });
  });

  it("uses native geolocation on Android and iOS after permission was granted", async () => {
    for (const platform of ["android", "ios"] as const) {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(Capacitor.getPlatform).mockReturnValue(platform);
      vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: "granted", coarseLocation: "granted" });
      vi.mocked(Geolocation.getCurrentPosition).mockResolvedValue(nativePosition);
      await expect(getCurrentLocation(5000)).resolves.toEqual({
        latitude: -23.55, longitude: -46.63, accuracy: 12,
      });
      expect(Geolocation.getCurrentPosition).toHaveBeenLastCalledWith({
        enableHighAccuracy: true, timeout: 5000, maximumAge: 30_000,
      });
    }
  });

  it("requests a native permission only when the OS reports a prompt state", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: "prompt", coarseLocation: "prompt" });
    vi.mocked(Geolocation.requestPermissions).mockResolvedValue({ location: "granted", coarseLocation: "granted" });
    vi.mocked(Geolocation.getCurrentPosition).mockResolvedValue(nativePosition);
    await expect(getCurrentLocation()).resolves.toMatchObject({ latitude: -23.55 });
    expect(Geolocation.requestPermissions).toHaveBeenCalledWith({ permissions: ["location"] });
  });

  it("reports a permission denied during the request in Portuguese", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: "prompt", coarseLocation: "prompt" });
    vi.mocked(Geolocation.requestPermissions).mockResolvedValue({ location: "denied", coarseLocation: "denied" });
    await expect(getCurrentLocation()).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
      message: expect.stringContaining("Permissão de localização negada"),
    });
  });

  it("does not ask again when a prior refusal is reported as denied", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: "denied", coarseLocation: "denied" });
    await expect(getCurrentLocation()).rejects.toMatchObject({
      code: "PERMISSION_BLOCKED",
      message: expect.stringContaining("configurações"),
    });
    expect(Geolocation.requestPermissions).not.toHaveBeenCalled();
  });

  it("remembers a refusal if the platform continues reporting a prompt state", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: "prompt", coarseLocation: "prompt" });
    vi.mocked(Geolocation.requestPermissions).mockResolvedValue({ location: "denied", coarseLocation: "denied" });
    await expect(getCurrentLocation()).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    vi.mocked(Geolocation.requestPermissions).mockClear();
    await expect(getCurrentLocation()).rejects.toMatchObject({ code: "PERMISSION_BLOCKED" });
    expect(Geolocation.requestPermissions).not.toHaveBeenCalled();
  });

  it("does not re-prompt when Android reports a prior refusal rationale state", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: "prompt-with-rationale", coarseLocation: "prompt-with-rationale" });
    await expect(getCurrentLocation()).rejects.toMatchObject({ code: "PERMISSION_BLOCKED" });
    expect(Geolocation.requestPermissions).not.toHaveBeenCalled();
  });

  it("maps disabled GPS and position timeout to friendly messages", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: "granted", coarseLocation: "granted" });
    vi.mocked(Geolocation.getCurrentPosition)
      .mockRejectedValueOnce(new Error("Location services are disabled"))
      .mockRejectedValueOnce(Object.assign(new Error("Timeout"), { code: 3 }));
    await expect(getCurrentLocation()).rejects.toMatchObject({ code: "GPS_DISABLED" });
    await expect(getCurrentLocation()).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("uses the browser geolocation fallback and translates its errors", async () => {
    const nativeGeolocation = navigator.geolocation;
    vi.mocked(nativeGeolocation.getCurrentPosition)
      .mockImplementationOnce((success) => success(browserPosition))
      .mockImplementationOnce((_success, error) => error?.({ code: 1, message: "User denied Geolocation" } as GeolocationPositionError))
      .mockImplementationOnce((_success, error) => error?.({ code: 3, message: "Timeout expired" } as GeolocationPositionError));
    await expect(getCurrentLocation()).resolves.toMatchObject({ longitude: -46.63 });
    await expect(getCurrentLocation()).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(getCurrentLocation()).rejects.toMatchObject({
      code: "TIMEOUT", message: expect.stringContaining("a tempo"),
    });
  });

  it("checks permission without prompting or obtaining a location", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: "granted", coarseLocation: "granted" });
    await expect(checkLocationPermission()).resolves.toMatchObject({ granted: true });
    expect(Geolocation.requestPermissions).not.toHaveBeenCalled();
    expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });
});
