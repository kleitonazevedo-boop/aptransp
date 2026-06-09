import { supabase } from "@/integrations/supabase/client";

export type LogLevel = "info" | "warn" | "error" | "debug";
export type LogSource = "google" | "gps" | "supabase" | "sptrans" | "gtfs" | "app";

export interface SystemLog {
  id?: string;
  user_id?: string | null;
  level: LogLevel;
  source: LogSource;
  message: string;
  meta?: Record<string, unknown> | null;
  created_at?: string;
}

export const logger = {
  async log(level: LogLevel, source: LogSource, message: string, meta?: Record<string, unknown>) {
    try {
      const { data: u } = await supabase.auth.getUser();
      const row = { user_id: u.user?.id ?? null, level, source, message, meta: meta ?? null };
      const { error } = await supabase.from("system_logs").insert(row);
      if (error) console.error("[logger]", error);
      // mirror to console for dev
      const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      fn(`[${source}]`, message, meta ?? "");
    } catch (e) { console.error("[logger:catch]", e); }
  },
  info: (s: LogSource, m: string, meta?: Record<string, unknown>) => logger.log("info", s, m, meta),
  warn: (s: LogSource, m: string, meta?: Record<string, unknown>) => logger.log("warn", s, m, meta),
  error: (s: LogSource, m: string, meta?: Record<string, unknown>) => logger.log("error", s, m, meta),

  async list(limit = 100): Promise<SystemLog[]> {
    const { data, error } = await supabase
      .from("system_logs").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) { console.error("[logger:list]", error); return []; }
    return (data ?? []) as SystemLog[];
  },
};
