import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "@/config/api";

describe("APTRANSP API environment", () => {
  it("allows the homelab HTTP endpoint only in local mode", () => {
    expect(resolveApiBaseUrl("http://192.168.15.124:3000/", "local"))
      .toBe("http://192.168.15.124:3000");
  });

  it("rejects public HTTP in local mode", () => {
    expect(() => resolveApiBaseUrl("http://api.example.com", "local"))
      .toThrow("HTTP no ambiente local só pode apontar");
  });

  it("requires HTTPS in production", () => {
    expect(() => resolveApiBaseUrl("http://192.168.15.124:3000", "production"))
      .toThrow("A API de produção precisa utilizar HTTPS");
  });

  it("rejects private HTTPS endpoints in production", () => {
    expect(() => resolveApiBaseUrl("https://192.168.15.124:3000", "production"))
      .toThrow("não pode apontar para uma rede privada");
  });

  it("accepts the future public HTTPS endpoint in production", () => {
    expect(resolveApiBaseUrl("https://api.aptransp.example", "production"))
      .toBe("https://api.aptransp.example");
  });
});
