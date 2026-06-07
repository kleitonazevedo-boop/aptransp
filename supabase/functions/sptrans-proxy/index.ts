// Edge Function: sptrans-proxy
// Deploy: supabase functions deploy sptrans-proxy --project-ref xitbkklflslcgzqskmml
// Secret necessário: SPTRANS_TOKEN  (set via Dashboard → Edge Functions → Secrets)
//
// Mantém cookie de autenticação em memória. Reautentica em 401.
// Endpoints expostos: passe path completo do Olho Vivo como query ?path=/Linha/Buscar&termosBusca=8000

const SPTRANS_BASE = "http://api.olhovivo.sptrans.com.br/v2.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

let cookieJar: string | null = null;

async function authenticate(): Promise<boolean> {
  const token = Deno.env.get("SPTRANS_TOKEN");
  if (!token) {
    console.error("[sptrans] SPTRANS_TOKEN ausente");
    return false;
  }
  const res = await fetch(`${SPTRANS_BASE}/Login/Autenticar?token=${encodeURIComponent(token)}`, {
    method: "POST",
  });
  if (!res.ok) {
    console.error("[sptrans] autenticação falhou:", res.status, await res.text());
    return false;
  }
  const ok = await res.json();
  if (!ok) return false;
  const setCookie = res.headers.get("set-cookie") ?? "";
  cookieJar = setCookie.split(";")[0] || null;
  return Boolean(cookieJar);
}

async function callOlhoVivo(path: string, params: URLSearchParams): Promise<Response> {
  const qs = params.toString();
  const url = `${SPTRANS_BASE}${path}${qs ? `?${qs}` : ""}`;
  const headers: HeadersInit = cookieJar ? { Cookie: cookieJar } : {};
  let res = await fetch(url, { headers });
  if (res.status === 401 || res.status === 403) {
    if (!(await authenticate())) {
      return new Response(JSON.stringify({ error: "sptrans_auth_failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    res = await fetch(url, { headers: cookieJar ? { Cookie: cookieJar } : {} });
  }
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path");
    if (!path || !path.startsWith("/")) {
      return new Response(JSON.stringify({ error: "missing_or_invalid_path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // remove "path" e mantém o resto como query SPTrans
    const params = new URLSearchParams(url.searchParams);
    params.delete("path");

    if (!cookieJar) await authenticate();
    return await callOlhoVivo(path, params);
  } catch (e) {
    console.error("[sptrans] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
