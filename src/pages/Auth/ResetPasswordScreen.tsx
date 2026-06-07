import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

const ResetPasswordScreen = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // O link de recovery do Supabase coloca tokens no hash (#access_token=...&type=recovery).
    // O client absorve isso automaticamente; só validamos que existe sessão.
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setErr("Link inválido ou expirado. Solicite um novo.");
      setReady(true);
    });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setErr("A senha deve ter ao menos 6 caracteres."); return; }
    setLoading(true); setErr(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-brand-purple text-white flex flex-col items-center justify-center p-6">
      <Logo className="w-12 h-12 mb-3" />
      <h1 className="text-xl font-bold mb-6">Nova senha</h1>
      <form onSubmit={submit} className="w-full max-w-sm bg-white/95 text-blue-900 rounded-3xl p-5 space-y-4 shadow-elevated">
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
               placeholder="Nova senha"
               className="w-full border-b border-blue-900/20 bg-transparent outline-none py-2 text-sm" />
        {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{err}</p>}
        <button disabled={loading || !ready} type="submit"
                className="w-full bg-brand-purple text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />} Atualizar senha
        </button>
      </form>
    </div>
  );
};

export default ResetPasswordScreen;
