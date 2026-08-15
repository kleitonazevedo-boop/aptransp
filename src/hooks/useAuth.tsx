import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getDb, LOCAL_USER_ID } from "@/database/database";
import { userRepository, type LocalUserProfile } from "@/repositories/userRepository";

/**
 * Sessão local: não existe autenticação remota.
 * O app opera sempre com o usuário local padrão persistido no SQLite.
 */
export interface LocalUser {
  id: string;
  email?: string | null;
  nome?: string | null;
}

interface AuthContextValue {
  user: LocalUser | null;
  profile: LocalUserProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, profile: null, loading: true, refresh: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<LocalUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      await getDb();
      const p = await userRepository.get();
      await userRepository.touchLogin();
      setProfile(p);
    } catch (e) {
      console.error("[auth] banco local indisponível", e);
      setProfile({ id: LOCAL_USER_ID, nome: "Usuário Local", is_admin: 1 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Sem login remoto: "sair" apenas recarrega o perfil local.
  const signOut = async () => { await refresh(); };

  const user: LocalUser | null = profile
    ? { id: profile.id, email: profile.email ?? null, nome: profile.nome ?? null }
    : null;

  return (
    <AuthContext.Provider value={{ user, profile, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
