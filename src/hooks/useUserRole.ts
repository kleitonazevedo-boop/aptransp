import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useUserRole() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setIsAdmin(false); setLoading(false); return; }
      const { data, error } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (cancelled) return;
      if (error) console.error("[role]", error);
      setIsAdmin(!!data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  return { isAdmin, loading };
}
