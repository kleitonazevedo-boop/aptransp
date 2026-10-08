function configuredBase(): string | undefined {
  return (import.meta.env.VITE_APTRANSP_API_URL as string | undefined)?.trim().replace(/\/$/, "");
}

function configuredEnvironment(): "local" | "production" {
  const value = (import.meta.env.VITE_APTRANSP_ENV as string | undefined)?.trim().toLowerCase();
  if (value === "local" || value === "production") return value;
  if (!value) return import.meta.env.DEV ? "local" : "production";
  throw new Error("VITE_APTRANSP_ENV deve ser 'local' ou 'production'.");
}

function isPrivateOrLocalHost(host: string): boolean {
  const value = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "localhost" || value.endsWith(".localhost") || value === "::1" || value === "0.0.0.0") return true;
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 169 && parts[1] === 254);
}

/** Valida a base da API de acordo com o ambiente, sem acessar a rede. */
export function resolveApiBaseUrl(base: string | undefined, environment: string): string {
  if (!base) throw new Error("API APTRANSP não configurada (VITE_APTRANSP_API_URL).");
  let parsed: URL;
  try { parsed = new URL(base.trim()); }
  catch { throw new Error("VITE_APTRANSP_API_URL deve ser uma URL HTTP(S) válida."); }

  if (environment !== "local" && environment !== "production") {
    throw new Error("VITE_APTRANSP_ENV deve ser 'local' ou 'production'.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("VITE_APTRANSP_API_URL deve ser uma URL HTTP(S) válida.");
  }
  if (environment === "production" && parsed.protocol !== "https:") {
    throw new Error("A API de produção precisa utilizar HTTPS.");
  }
  if (environment === "production" && isPrivateOrLocalHost(parsed.hostname)) {
    throw new Error("A URL de produção da API não pode apontar para uma rede privada ou endereço local.");
  }
  if (environment === "local" && parsed.protocol === "http:" && !isPrivateOrLocalHost(parsed.hostname)) {
    throw new Error("HTTP no ambiente local só pode apontar para um endereço privado ou local.");
  }
  return parsed.toString().replace(/\/$/, "");
}

/** Configuração central da API; os mesmos valores são incorporados ao bundle Capacitor. */
export function getApiBaseUrl(): string {
  return resolveApiBaseUrl(configuredBase(), configuredEnvironment());
}
