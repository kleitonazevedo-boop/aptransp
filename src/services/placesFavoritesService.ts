import { supabase } from "@/integrations/supabase/client";

export type FavoriteKind = "casa" | "trabalho" | "custom";

export interface FavoritePlace {
  id?: string;
  user_id?: string;
  label: string;
  endereco: string;
  latitude?: number | null;
  longitude?: number | null;
  kind: FavoriteKind;
  created_at?: string;
}

export const placesFavoritesService = {
  async list(): Promise<FavoritePlace[]> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return [];
    const { data, error } = await supabase
      .from("favorite_places").select("*").eq("user_id", u.user.id)
      .order("created_at", { ascending: false });
    if (error) { console.error("[fp:list]", error); return []; }
    return (data ?? []) as FavoritePlace[];
  },

  async add(p: Omit<FavoritePlace, "id" | "user_id" | "created_at">): Promise<FavoritePlace | null> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data, error } = await supabase
      .from("favorite_places").insert({ ...p, user_id: u.user.id }).select().single();
    if (error) { console.error("[fp:add]", error); return null; }
    return data as FavoritePlace;
  },

  async remove(id: string): Promise<boolean> {
    const { error } = await supabase.from("favorite_places").delete().eq("id", id);
    if (error) { console.error("[fp:rm]", error); return false; }
    return true;
  },
};
