import { createClient } from "@supabase/supabase-js";

// External Supabase instance (publishable anon key — safe to embed client-side).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configurados");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const SUPABASE_PROJECT_URL = SUPABASE_URL;
