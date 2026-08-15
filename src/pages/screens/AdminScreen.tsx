import { ArrowLeft, ShieldAlert, Activity, MapPin, Upload, FileText } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  onBack: () => void;
  onDiagnostics: () => void;
  onGpsDebug: () => void;
  onGtfs: () => void;
  onLogs: () => void;
}

const AdminScreen = ({ onBack, onDiagnostics, onGpsDebug, onGtfs, onLogs }: Props) => {
  const { isAdmin, loading } = useUserRole();

  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="bg-brand-purple text-white px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={onBack} aria-label="Voltar" className="p-1"><ArrowLeft className="w-6 h-6" /></button>
        <Logo className="w-8 h-8" />
        <ShieldAlert className="w-5 h-5 text-brand-yellow" />
      </header>
      <div className="bg-brand-yellow text-blue-900 text-center text-sm font-bold py-2">Administrador</div>

      <div className="flex-1 overflow-y-auto bg-amber-50 p-4 space-y-3">
        {loading ? <p className="text-sm text-blue-900/60 text-center py-12">Validando acesso…</p> :
         !isAdmin ? (
          <div className="bg-red-100 text-red-800 text-sm rounded-xl p-4">
            Acesso restrito. Você não é administrador.
          </div>
        ) : (
          <>
            <Tile icon={<Activity className="w-5 h-5" />} label="Diagnóstico do Sistema"
                  description="Banco local, GTFS, Google, GPS e conectividade" onClick={onDiagnostics} />
            <Tile icon={<MapPin className="w-5 h-5" />} label="Debug Geolocalização Android"
                  description="Permissões, GPS, lat/lng, precisão" onClick={onGpsDebug} />
            <Tile icon={<Upload className="w-5 h-5" />} label="Importação SPTrans (GTFS)"
                  description="Importa os arquivos direto no banco local" onClick={onGtfs} />
            <Tile icon={<FileText className="w-5 h-5" />} label="Logs do Sistema"
                  description="Erros e eventos registrados" onClick={onLogs} />
          </>
        )}
      </div>
    </div>
  );
};

const Tile = ({ icon, label, description, onClick }:
  { icon: React.ReactNode; label: string; description: string; onClick: () => void }) => (
  <button onClick={onClick}
          className="w-full bg-white rounded-2xl p-4 flex items-center gap-3 text-left shadow-sm hover:bg-amber-50">
    <div className="w-10 h-10 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center">{icon}</div>
    <div className="flex-1">
      <p className="text-sm font-bold text-blue-900">{label}</p>
      <p className="text-xs text-blue-900/60">{description}</p>
    </div>
  </button>
);

export default AdminScreen;
