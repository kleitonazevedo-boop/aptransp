import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  id?: string;
  auth_user_id?: string;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  data_nascimento?: string | null;
  idade?: number | null;
  endereco_residencial?: string | null;
  endereco_trabalho?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

export const profileService = {
  async getMyProfile(): Promise<UserProfile | null> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data, error } = await supabase
      .from("user_profile").select("*").eq("auth_user_id", u.user.id).maybeSingle();
    if (error) { console.error("[profile:get]", error); return null; }
    return data;
  },

  async upsertMyProfile(p: Partial<UserProfile>): Promise<UserProfile | null> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const row = { ...p, auth_user_id: u.user.id, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from("user_profile")
      .upsert(row, { onConflict: "auth_user_id" })
      .select().single();
    if (error) { console.error("[profile:upsert]", error); return null; }
    return data;
  },
};
