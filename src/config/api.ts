function configuredBase(): string | undefined {
  return (import.meta.env.VITE_APTRANSP_API_URL as string | undefined)?.trim().replace(/\/$/, "");
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

/** Configuração central da API. Builds publicados aceitam somente HTTPS público. */
export function getApiBaseUrl(): string {
  const base = configuredBase();
  if (!base) throw new Error("API APTRANSP não configurada (VITE_APTRANSP_API_URL).");
  let parsed: URL;
  try { parsed = new URL(base); }
  catch { throw new Error("VITE_APTRANSP_API_URL deve ser uma URL HTTP(S) válida."); }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("VITE_APTRANSP_API_URL deve ser uma URL HTTP(S) válida.");
  }
  if (parsed.protocol === "http:" && !import.meta.env.DEV) {
    throw new Error("A API de produção precisa utilizar HTTPS.");
  }
  if (import.meta.env.PROD && isPrivateOrLocalHost(parsed.hostname)) {
    throw new Error("A URL de produção da API não pode apontar para uma rede privada ou endereço local.");
  }
  return parsed.toString().replace(/\/$/, "");
}
