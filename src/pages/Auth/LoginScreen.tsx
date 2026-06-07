import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import trainBg from "@/assets/login-train.jpg";

const LoginScreen = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-purple text-white relative overflow-hidden">
      <img src={trainBg} alt="" aria-hidden="true"
           className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-brand-purple/80 via-brand-purple/60 to-brand-purple" />

      <div className="relative z-10 flex-1 flex flex-col p-6">
        <div className="flex flex-col items-center mt-12 mb-10">
          <Logo className="w-16 h-16 mb-3" />
          <h1 className="text-2xl font-bold tracking-wide">APTRANSP</h1>
          <p className="text-sm opacity-80">Mobilidade urbana inteligente</p>
        </div>

        <form onSubmit={submit} className="bg-white/95 text-blue-900 rounded-3xl p-6 shadow-elevated space-y-4">
          <h2 className="text-lg font-bold">Entrar</h2>

          <label className="block">
            <span className="text-xs font-semibold text-blue-900/70">E-mail</span>
            <div className="mt-1 flex items-center gap-2 border-b border-blue-900/20 pb-2">
              <Mail className="w-4 h-4 opacity-60" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                     className="flex-1 bg-transparent outline-none text-sm" placeholder="voce@email.com" />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-blue-900/70">Senha</span>
            <div className="mt-1 flex items-center gap-2 border-b border-blue-900/20 pb-2">
              <Lock className="w-4 h-4 opacity-60" />
              <input type={show ? "text" : "password"} required value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className="flex-1 bg-transparent outline-none text-sm" placeholder="••••••••" />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label="Mostrar senha">
                {show ? <EyeOff className="w-4 h-4 opacity-60" /> : <Eye className="w-4 h-4 opacity-60" />}
              </button>
            </div>
          </label>

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}

          <button disabled={loading} type="submit"
                  className="w-full bg-brand-purple text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Entrar
          </button>

          <button type="button" disabled
                  className="w-full bg-white border border-blue-900/15 rounded-full py-3 text-sm font-semibold text-blue-900/40">
            Continuar com Google (em breve)
          </button>

          <div className="flex items-center justify-between text-xs">
            <Link to="/forgot-password" className="text-brand-purple font-semibold">Esqueci minha senha</Link>
            <Link to="/signup" className="text-brand-purple font-semibold">Criar conta</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
