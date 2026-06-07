import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null); setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) setErr(error.message);
    else setMsg("Se o e-mail estiver cadastrado, enviaremos as instruções.");
  };

  return (
    <div className="min-h-screen bg-brand-purple text-white flex flex-col">
      <header className="px-4 pt-4 pb-3 flex items-center justify-between">
        <Link to="/login" aria-label="Voltar" className="p-1"><ArrowLeft className="w-6 h-6" /></Link>
        <Logo className="w-8 h-8" />
        <span className="w-6" />
      </header>
      <div className="flex-1 px-6 pt-6">
        <h1 className="text-2xl font-bold text-center mb-2">Recuperar senha</h1>
        <p className="text-center text-sm opacity-80 mb-6">Informe seu e-mail para receber o link.</p>
        <form onSubmit={submit} className="bg-white/95 text-blue-900 rounded-3xl p-5 space-y-4 shadow-elevated">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                 placeholder="seu@email.com"
                 className="w-full border-b border-blue-900/20 bg-transparent outline-none py-2 text-sm" />
          {msg && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-2">{msg}</p>}
          {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{err}</p>}
          <button disabled={loading} type="submit"
                  className="w-full bg-brand-purple text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Enviar link
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordScreen;
