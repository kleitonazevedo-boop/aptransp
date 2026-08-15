import { favoritesRepository, type LocalFavoriteRoute } from "@/repositories/favoritesRepository";

export type FavoriteRoute = LocalFavoriteRoute;

export const favoritesService = {
  async add(f: Omit<FavoriteRoute, "id" | "user_id" | "created_at">): Promise<FavoriteRoute | null> {
    try { return await favoritesRepository.addRoute(f); }
    catch (e) { console.error("[fav:add]", e); return null; }
  },

  async list(limit = 10): Promise<FavoriteRoute[]> {
    try { return await favoritesRepository.listRoutes(limit); }
    catch (e) { console.error("[fav:list]", e); return []; }
  },

  async remove(id: string): Promise<boolean> {
    try { await favoritesRepository.removeRoute(id); return true; }
    catch (e) { console.error("[fav:rm]", e); return false; }
  },
};
