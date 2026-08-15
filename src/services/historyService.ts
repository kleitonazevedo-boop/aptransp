import { historyRepository, type LocalHistoryItem } from "@/repositories/historyRepository";

export type RouteHistoryItem = LocalHistoryItem;

export const historyService = {
  async push(h: Omit<RouteHistoryItem, "id" | "user_id" | "created_at">): Promise<void> {
    try { await historyRepository.push(h); }
    catch (e) { console.error("[history:push]", e); }
  },

  async listRecent(limit = 5): Promise<RouteHistoryItem[]> {
    try { return await historyRepository.listRecent(limit); }
    catch (e) { console.error("[history:list]", e); return []; }
  },

  async remove(id: string): Promise<void> {
    try { await historyRepository.remove(id); } catch (e) { console.error("[history:rm]", e); }
  },

  async clear(): Promise<void> {
    try { await historyRepository.clear(); } catch (e) { console.error("[history:clear]", e); }
  },
};
