import { afterEach, describe, expect, it, vi } from "vitest";
import { getApiBaseUrl } from "@/config/api";

describe("APTRANSP API environment", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("allows the homelab HTTP endpoint only in local mode", () => {
    vi.stubEnv("VITE_APTRANSP_ENV", "local");
    vi.stubEnv("VITE_APTRANSP_API_URL", "http://192.168.15.124:3000/");
    expect(getApiBaseUrl()).toBe("http://192.168.15.124:3000");
  });

  it("rejects public HTTP in local mode", () => {
    vi.stubEnv("VITE_APTRANSP_ENV", "local");
    vi.stubEnv("VITE_APTRANSP_API_URL", "http://api.example.com");
    expect(() => getApiBaseUrl()).toThrow("HTTP no ambiente local só pode apontar");
  });

  it("requires public HTTPS in production", () => {
    vi.stubEnv("VITE_APTRANSP_ENV", "production");
    vi.stubEnv("VITE_APTRANSP_API_URL", "http://192.168.15.124:3000");
    expect(() => getApiBaseUrl()).toThrow("A API de produção precisa utilizar HTTPS");
  });

  it("rejects private HTTPS endpoints in production", () => {
    vi.stubEnv("VITE_APTRANSP_ENV", "production");
    vi.stubEnv("VITE_APTRANSP_API_URL", "https://192.168.15.124:3000");
    expect(() => getApiBaseUrl()).toThrow("não pode apontar para uma rede privada");
  });

  it("accepts the future public HTTPS endpoint in production", () => {
    vi.stubEnv("VITE_APTRANSP_ENV", "production");
    vi.stubEnv("VITE_APTRANSP_API_URL", "https://api.aptransp.example");
    expect(getApiBaseUrl()).toBe("https://api.aptransp.example");
  });
});
