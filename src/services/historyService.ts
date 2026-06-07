import { supabase } from "@/integrations/supabase/client";

export interface RouteHistoryItem {
  id?: string;
  user_id?: string;
  origem: string;
  destino: string;
  modo_transporte: string;
  distancia?: number | null;
  tempo_estimado?: number | null;
  created_at?: string;
}

export const historyService = {
  async push(h: Omit<RouteHistoryItem, "id" | "user_id" | "created_at">): Promise<void> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("route_history").insert({ ...h, user_id: u.user.id });
    if (error) console.error("[history:push]", error);
  },

  async listRecent(limit = 5): Promise<RouteHistoryItem[]> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return [];
    const { data, error } = await supabase
      .from("route_history").select("*")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: false }).limit(limit);
    if (error) { console.error("[history:list]", error); return []; }
    return data ?? [];
  },
};
