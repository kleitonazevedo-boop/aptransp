import { logsRepository, type LogLevel, type LogSource, type LocalSystemLog } from "@/repositories/logsRepository";

export type { LogLevel, LogSource };

export interface SystemLog extends Omit<LocalSystemLog, "meta"> {
  meta?: string | Record<string, unknown> | null;
}

export const logger = {
  async log(level: LogLevel, source: LogSource, message: string, meta?: Record<string, unknown>) {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(`[${source}]`, message, meta ?? "");
    try { await logsRepository.insert(level, source, message, meta); }
    catch (e) { console.error("[logger]", e); }
  },
  info: (s: LogSource, m: string, meta?: Record<string, unknown>) => logger.log("info", s, m, meta),
  warn: (s: LogSource, m: string, meta?: Record<string, unknown>) => logger.log("warn", s, m, meta),
  error: (s: LogSource, m: string, meta?: Record<string, unknown>) => logger.log("error", s, m, meta),

  async list(limit = 100): Promise<SystemLog[]> {
    try { return await logsRepository.list(limit); }
    catch (e) { console.error("[logger:list]", e); return []; }
  },

  async clear(): Promise<void> {
    try { await logsRepository.clear(); } catch (e) { console.error("[logger:clear]", e); }
  },
};
