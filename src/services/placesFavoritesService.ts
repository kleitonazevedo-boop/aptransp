import { favoritesRepository, type LocalFavoritePlace, type FavoriteKind } from "@/repositories/favoritesRepository";

export type { FavoriteKind };
export type FavoritePlace = LocalFavoritePlace;

export const placesFavoritesService = {
  async list(): Promise<FavoritePlace[]> {
    try { return await favoritesRepository.listPlaces(); }
    catch (e) { console.error("[fp:list]", e); return []; }
  },

  async getByKind(kind: FavoriteKind): Promise<FavoritePlace | null> {
    try { return await favoritesRepository.getPlaceByKind(kind); }
    catch (e) { console.error("[fp:kind]", e); return null; }
  },

  async add(p: Omit<FavoritePlace, "id" | "user_id" | "created_at">): Promise<FavoritePlace | null> {
    try { return await favoritesRepository.addPlace(p); }
    catch (e) { console.error("[fp:add]", e); return null; }
  },

  async remove(id: string): Promise<boolean> {
    try { await favoritesRepository.removePlace(id); return true; }
    catch (e) { console.error("[fp:rm]", e); return false; }
  },
};
