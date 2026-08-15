import { getDb, newId, LOCAL_USER_ID } from "@/database/database";

export interface LocalUserProfile {
  id: string;
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
  is_admin?: number;
  ultimo_login?: string | null;
}

const FIELDS = [
  "nome", "email", "telefone", "data_nascimento", "idade",
  "endereco_residencial", "endereco_trabalho", "cidade", "estado", "cep",
  "avatar_url", "latitude_residencial", "longitude_residencial",
  "latitude_trabalho", "longitude_trabalho", "is_admin", "ultimo_login",
] as const;

export const userRepository = {
  localUserId: LOCAL_USER_ID,

  async get(): Promise<LocalUserProfile> {
    const db = await getDb();
    const row = await db.one<LocalUserProfile>("SELECT * FROM user_profile WHERE id = ?;", [LOCAL_USER_ID]);
    if (row) return row;
    await db.run("INSERT INTO user_profile (id, nome, is_admin) VALUES (?, ?, 1);", [LOCAL_USER_ID, "Usuário Local"]);
    return { id: LOCAL_USER_ID, nome: "Usuário Local", is_admin: 1 };
  },

  async update(patch: Partial<LocalUserProfile>): Promise<LocalUserProfile> {
    const db = await getDb();
    await this.get();
    const keys = FIELDS.filter((f) => f in patch);
    if (keys.length) {
      const sets = keys.map((k) => `${k} = ?`).join(", ");
      const values = keys.map((k) => {
        const v = patch[k];
        return (v === undefined || v === "" ? null : v) as string | number | null;
      });
      await db.run(
        `UPDATE user_profile SET ${sets}, updated_at = datetime('now') WHERE id = ?;`,
        [...values, LOCAL_USER_ID],
      );
    }
    return this.get();
  },

  async touchLogin(): Promise<void> {
    const db = await getDb();
    await db.run("UPDATE user_profile SET ultimo_login = datetime('now') WHERE id = ?;", [LOCAL_USER_ID]);
  },

  async isAdmin(): Promise<boolean> {
    const p = await this.get();
    return Number(p.is_admin ?? 1) === 1;
  },

  /** Avatar é armazenado como data URL no próprio banco (sem storage remoto). */
  async saveAvatar(file: File): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(file);
    });
    await this.update({ avatar_url: dataUrl });
    return dataUrl;
  },

  newId,
};
