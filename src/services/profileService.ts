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
  avatar_url?: string | null;
  latitude_residencial?: number | null;
  longitude_residencial?: number | null;
  latitude_trabalho?: number | null;
  longitude_trabalho?: number | null;
  ultimo_login?: string | null;
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

  async uploadAvatar(file: File): Promise<string | null> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${u.user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { console.error("[avatar]", error); return null; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  },
};
