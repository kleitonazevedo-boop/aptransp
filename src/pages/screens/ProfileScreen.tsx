import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Save, Camera, User as UserIcon } from "lucide-react";
import { Logo } from "@/components/Logo";
import { profileService, type UserProfile } from "@/services/profileService";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/services/loggerService";

interface Props { onBack: () => void }

const ProfileScreen = ({ onBack }: Props) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const p = await profileService.getMyProfile();
      setProfile(p ?? { email: user?.email ?? "" });
      setLoading(false);
    })();
  }, [user]);

  const upd = <K extends keyof UserProfile>(k: K, v: UserProfile[K]) =>
    setProfile((prev) => ({ ...prev, [k]: v }));

  const onSave = async () => {
    setSaving(true); setError(null); setInfo(null);
    const saved = await profileService.upsertMyProfile(profile);
    if (saved) { setProfile(saved); setInfo("Perfil salvo."); void logger.info("app", "Profile saved"); }
    else { setError("Não foi possível salvar."); void logger.error("database", "Profile save failed"); }
    setSaving(false);
  };

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const url = await profileService.uploadAvatar(f);
    if (url) { upd("avatar_url", url); setInfo("Avatar enviado. Clique Salvar."); }
    else setError("Falha ao enviar foto.");
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="bg-brand-purple text-white px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={onBack} aria-label="Voltar" className="p-1"><ArrowLeft className="w-6 h-6" /></button>
        <Logo className="w-8 h-8" />
        <UserIcon className="w-5 h-5 text-brand-yellow" />
      </header>
      <div className="bg-brand-yellow text-blue-900 text-center text-sm font-bold py-2">Meu Perfil</div>

      <div className="flex-1 overflow-y-auto bg-amber-50 p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-brand-purple" /></div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-full bg-amber-200 overflow-hidden flex items-center justify-center">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  : <UserIcon className="w-10 h-10 text-amber-800" />}
              </div>
              <label className="flex items-center gap-2 bg-white border border-amber-200 rounded-full px-3 py-1 text-xs text-blue-900 cursor-pointer">
                <Camera className="w-3 h-3" /> Trocar foto
                <input type="file" accept="image/*" className="hidden" onChange={onAvatar} />
              </label>
            </div>

            <Section title="Dados pessoais">
              <Field label="Nome completo" value={profile.nome ?? ""} onChange={(v) => upd("nome", v)} />
              <Field label="Email" type="email" value={profile.email ?? ""} onChange={(v) => upd("email", v)} />
              <Field label="Telefone" value={profile.telefone ?? ""} onChange={(v) => upd("telefone", v)} />
              <Field label="Data de nascimento" type="date" value={profile.data_nascimento ?? ""} onChange={(v) => upd("data_nascimento", v)} />
            </Section>

            <Section title="Endereços">
              <Field label="Endereço residencial" value={profile.endereco_residencial ?? ""} onChange={(v) => upd("endereco_residencial", v)} />
              <Field label="Endereço de trabalho" value={profile.endereco_trabalho ?? ""} onChange={(v) => upd("endereco_trabalho", v)} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Cidade" value={profile.cidade ?? ""} onChange={(v) => upd("cidade", v)} />
                <Field label="Estado" value={profile.estado ?? ""} onChange={(v) => upd("estado", v)} />
              </div>
              <Field label="CEP" value={profile.cep ?? ""} onChange={(v) => upd("cep", v)} />
            </Section>

            {error && <div className="bg-red-100 text-red-800 text-xs rounded-xl px-3 py-2">{error}</div>}
            {info && <div className="bg-emerald-100 text-emerald-800 text-xs rounded-xl px-3 py-2">{info}</div>}

            <div className="flex gap-2">
              <button onClick={onBack}
                      className="flex-1 bg-white border border-amber-300 text-blue-900 rounded-full py-3 text-sm font-semibold">
                Cancelar
              </button>
              <button onClick={onSave} disabled={saving}
                      className="flex-1 bg-brand-purple text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-2xl p-3 space-y-2 shadow-sm">
    <p className="text-xs font-bold text-blue-900">{title}</p>
    {children}
  </div>
);

const Field = ({ label, value, onChange, type = "text" }:
  { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
  <label className="block">
    <span className="text-[11px] text-blue-900/70">{label}</span>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
           className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-blue-900 outline-none focus:border-brand-purple" />
  </label>
);

export default ProfileScreen;
