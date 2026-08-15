import { useEffect, useState } from "react";
import { userRepository } from "@/repositories/userRepository";

/** Papel do usuário local (armazenado em user_profile.is_admin no SQLite). */
export function useUserRole() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const admin = await userRepository.isAdmin();
        if (!cancelled) setIsAdmin(admin);
      } catch (e) {
        console.error("[role]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { isAdmin, loading };
}
