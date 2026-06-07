import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { profileService } from "@/services/profileService";

const calcAge = (iso: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
};

const SignupScreen = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome: "", email: "", password: "", telefone: "",
    data_nascimento: "", endereco_residencial: "", endereco_trabalho: "",
    cidade: "", estado: "", cep: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idade = useMemo(() => calcAge(form.data_nascimento), [form.data_nascimento]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { nome: form.nome },
        },
      });
      if (error) throw error;
      // tentativa imediata (caso confirmação esteja desligada e usuário já tenha sessão)
      if (data.user) {
        await profileService.upsertMyProfile({
          nome: form.nome,
          email: form.email,
          telefone: form.telefone,
          data_nascimento: form.data_nascimento || null,
          endereco_residencial: form.endereco_residencial,
          endereco_trabalho: form.endereco_trabalho,
          cidade: form.cidade, estado: form.estado, cep: form.cep,
        });
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-purple text-white">
      <header className="px-4 pt-4 pb-3 flex items-center justify-between">
        <Link to="/login" aria-label="Voltar" className="p-1"><ArrowLeft className="w-6 h-6" /></Link>
        <Logo className="w-8 h-8" />
        <span className="w-6" />
      </header>

      <div className="px-6 pb-10">
        <h1 className="text-2xl font-bold text-center mb-1">Criar conta</h1>
        <p className="text-center text-sm opacity-80 mb-6">Configure seu perfil para uma experiência completa.</p>

        <form onSubmit={submit} className="bg-white/95 text-blue-900 rounded-3xl p-5 space-y-3 shadow-elevated">
          <Field label="Nome completo *" value={form.nome} onChange={set("nome")} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data de nascimento" type="date" value={form.data_nascimento} onChange={set("data_nascimento")} />
            <Field label="Idade" value={idade !== null ? String(idade) : ""} readOnly />
          </div>
          <Field label="E-mail *" type="email" value={form.email} onChange={set("email")} required />
          <Field label="Senha *" type="password" value={form.password} onChange={set("password")} required />
          <Field label="Telefone" value={form.telefone} onChange={set("telefone")} />
          <Field label="Endereço residencial" value={form.endereco_residencial} onChange={set("endereco_residencial")} />
          <Field label="Endereço de trabalho" value={form.endereco_trabalho} onChange={set("endereco_trabalho")} />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Cidade" value={form.cidade} onChange={set("cidade")} />
            <Field label="UF" value={form.estado} onChange={set("estado")} />
            <Field label="CEP" value={form.cep} onChange={set("cep")} />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}

          <button disabled={loading} type="submit"
                  className="w-full bg-brand-purple text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Criar conta
          </button>
          <p className="text-center text-xs text-blue-900/70">
            Já tem conta?{" "}
            <Link to="/login" className="text-brand-purple font-semibold">Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

const Field = ({ label, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="block">
    <span className="text-[11px] font-semibold text-blue-900/70">{label}</span>
    <input {...rest}
           className="w-full mt-1 bg-transparent border-b border-blue-900/20 outline-none text-sm pb-1" />
  </label>
);

export default SignupScreen;
