import { createClient } from "@supabase/supabase-js";

// External Supabase instance (publishable anon key — safe to embed client-side).
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://xitbkklflslcgzqskmml.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "sb_publishable_3zn-7yYhTatL5x82T5BaSg_3ieIazI9";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const SUPABASE_PROJECT_URL = SUPABASE_URL;
