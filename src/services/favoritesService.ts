import { supabase } from "@/integrations/supabase/client";

export interface FavoriteRoute {
  id?: string;
  user_id?: string;
  origem: string;
  destino: string;
  modo_transporte: string;
  distancia?: number | null;
  tempo_estimado?: number | null;
  created_at?: string;
}

export const favoritesService = {
  async add(f: Omit<FavoriteRoute, "id" | "user_id" | "created_at">): Promise<FavoriteRoute | null> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data, error } = await supabase
      .from("favorite_routes").insert({ ...f, user_id: u.user.id }).select().single();
    if (error) { console.error("[fav:add]", error); return null; }
    return data;
  },

  async list(limit = 10): Promise<FavoriteRoute[]> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return [];
    const { data, error } = await supabase
      .from("favorite_routes").select("*")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: false }).limit(limit);
    if (error) { console.error("[fav:list]", error); return []; }
    return data ?? [];
  },

  async remove(id: string): Promise<boolean> {
    const { error } = await supabase.from("favorite_routes").delete().eq("id", id);
    if (error) { console.error("[fav:rm]", error); return false; }
    return true;
  },
};
